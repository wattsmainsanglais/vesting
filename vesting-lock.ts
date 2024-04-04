import {
    Blockfrost,
    C,
    Data,
    Lucid,
    SpendingValidator,
    TxHash,
    fromHex,
    toHex,
  } from "https://deno.land/x/lucid@0.8.3/mod.ts";
  import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";
  
  const lucid = await Lucid.new(
    new Blockfrost(
      "https://cardano-preview.blockfrost.io/api/v0",
      Deno.env.get("BLOCKFROST_API_KEY"),
    ),
    "Preview",
  );
   
  lucid.selectWalletFromPrivateKey(await Deno.readTextFile("./owner.sk"));
   
  const validator = await readValidator();
   
  // --- Supporting functions
   
  async function readValidator(): Promise<SpendingValidator> {
    const validator = JSON.parse(await Deno.readTextFile("plutus.json")).validators[0];
    return {
      type: "PlutusV2",
      script: toHex(cbor.encode(fromHex(validator.compiledCode))),
    };
  }


  const ownerPublicKeyHash = lucid.utils.getAddressDetails(
    await lucid.wallet.address()
  ).paymentCredential.hash;
   
  const beneficiaryPublicKeyHash =
    lucid.utils.getAddressDetails(await Deno.readTextFile("beneficiary.addr"))
      .paymentCredential.hash;
   
  const Datum = Data.Object({
    lock_until: Data.BigInt, // this is POSIX time, you can check and set it here: https://www.unixtimestamp.com
    owner: Data.String, // we can pass owner's verification key hash as byte array but also as a string
    beneficiary: Data.String, // we can beneficiary's hash as byte array but also as a string
  });
   
  type Datum = Data.Static<typeof Datum>;
   
  const datum = Data.to<Datum>(
    {
      lock_until: 1712223005n, // Thu Apr 04 2024 11:30:05 GMT+0200
      owner: ownerPublicKeyHash, // our own wallet verification key hash
      beneficiary: beneficiaryPublicKeyHash,
    },
    Datum
  );
   
  const txLock = await lock(1000000n, { into: validator, datum: datum });
   
  await lucid.awaitTx(txLock);
   
  console.log(`1 tADA locked into the contract
      Tx ID: ${txLock}
      Datum: ${datum}
  `);
   
  // --- Supporting functions
   
  async function lock(lovelace: bigint, { into, datum }: { into: SpendingValidator, datum: string}): Promise<TxHash> {
    const contractAddress = lucid.utils.validatorToAddress(into);
   
    const tx = await lucid
      .newTx()
      .payToContract(contractAddress, { inline: datum }, { lovelace })
      .complete();
   
    const signedTx = await tx.sign().complete();
   
    return signedTx.submit();
  }
