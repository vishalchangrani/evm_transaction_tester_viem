// Import necessary Viem modules and functions
import {
  Address,
  TransactionRequest,
  createWalletClient,
  createPublicClient,
  WalletClient,
  http,
  formatEther,
  parseEther,
  publicActions,
} from "viem";

import { privateKeyToAccount } from "viem/accounts"; // Convert private key to account
import { sepolia } from "viem/chains"; // Reference to the Sepolia test network
import dotenv from "dotenv"; // For loading environment variables
import path from 'path';
dotenv.config();

import express, { Request, Response } from 'express';

const app = express();
const port = 3000;
const n = 1; // Number of transactions

// Define the amount of ETH to send
const ethAmount = parseEther("0.001");

const PRIVATE_KEY = process.env.PRIVATE_KEY as Address;

// Convert the private key to an account object
const account = privateKeyToAccount(PRIVATE_KEY);

app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
app.post('/runTest', async (req: Request, res: Response) => {
    const rpcEndpoint: string = req.body.rpcEndpoint;
    let walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcEndpoint),
    }).extend(publicActions);

    let publicClient = createPublicClient({
        chain: sepolia,
        transport: http(rpcEndpoint),
    });

    const balanceFrom = await walletClient.getBalance({
        address: account.address,
      });

      if (balanceFrom < ethAmount) {
        throw new Error("Insufficient ETH balance.");
      }

    console.log(
        `The balance of the sender (${account.address}) is: ${formatEther(balanceFrom)} ETH`
      );

    const results: { firstConfirmationTime: number, softFinalityTime: number, hardFinalityTime: number }[] = [];
    for (let i = 0; i < n; i++) {
        let startTime = Date.now();

        let txHash = await walletClient.sendTransaction({
            to: account.address,
            value: ethAmount,
        });

        let receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        let firstConfirmationTime = Date.now() - startTime
        // Log the transaction details
        console.log(
          `The transaction ${txHash} of sending ${formatEther(
            ethAmount
           )} ETH to ${account.address} is sent to the blockchain.`
        );
        console.log(`⏳ Transaction included in block: ${receipt.blockNumber}`);
        console.log(`⏱️ Time to first receipt: ${firstConfirmationTime} seconds`);


        // Function to wait for multiple confirmations
        async function waitForConfirmations(txHash: `0x${string}`, requiredConfirmations: number): Promise<number> {
          let confirmations = 0;
          let receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

          while (confirmations < requiredConfirmations) {
            const latestBlock = await publicClient.getBlockNumber();
            confirmations = Number(latestBlock - receipt.blockNumber);
            
            console.log(`🔄 Confirmations: ${confirmations}/${requiredConfirmations}`);
            if (confirmations < requiredConfirmations) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait ~12 sec (Ethereum avg block time)
            }
          }
          return Date.now();
        }

        // Wait for soft finality (6 confirmations)
        let softFinalityTime = await waitForConfirmations(txHash, 6);
        softFinalityTime = softFinalityTime - startTime,
        console.log(`🛡️ Soft finality reached at block: ${Number(receipt.blockNumber) + 6}`);
        console.log(`⏱️ Time to soft finality: ${softFinalityTime / 1000} seconds`);

        // Wait for hard finality (12 confirmations)
        let hardFinalityTime = await waitForConfirmations(txHash, 12);
        hardFinalityTime = hardFinalityTime - startTime
        console.log(`✅ Hard finality reached at block: ${Number(receipt.blockNumber) + 12}`);
        console.log(`⏱️ Time to hard finality: ${hardFinalityTime / 1000} seconds`);

        console.log(`🎉 Transaction ${txHash} fully confirmed and final!`);


        results.push({
            firstConfirmationTime: firstConfirmationTime,
            softFinalityTime: softFinalityTime,
            hardFinalityTime: hardFinalityTime
        });
    }

    let averagefirstConfirmationTime = results.reduce((acc, cur) => acc + cur.firstConfirmationTime, 0) / n;
    let averageSoftFinality = results.reduce((acc, cur) => acc + cur.softFinalityTime, 0) / n;
    let averageHardFinality = results.reduce((acc, cur) => acc + cur.hardFinalityTime, 0) / n;

    res.json({ averagefirstConfirmationTime, averageSoftFinality, averageHardFinality });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
