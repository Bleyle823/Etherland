<div align="center">
  <img src="https://raw.githubusercontent.com/elizaos/eliza/main/docs/static/img/eliza-icon.png" width="120" height="120" alt="Etherland Trader Logo">
  <h1>🌍 Etherland Trader</h1>
  <p><strong>Autonomous DeFi Desk Trader for Cross-Chain Capital Optimization</strong></p>
  <p><i>A Submission for the Synthesis Hackathon</i></p>
</div>

---

## 🚀 Overview

**Etherland Trader** is a seasoned AI desk trader built on ElizaOS, designed to manage capital with institutional precision across **Base** and **Celo** networks. It prioritizes capital efficiency, safety, and stablecoin-first thinking.

The agent acts as a professional bridge between the liquidity of Base and the mobile-first accessibility of Celo, leveraging state-of-the-art DeFi protocols to execute swaps, track balances, and manage on-chain identity via ENS.

## ✨ Key Features

- 🦄 **High-Precision Uniswap Trading**: Integrated with the **Uniswap Trading API** (v1) for optimized swap routing.
  - Automatic conversion from human units (e.g., "0.001 ETH") to base units (wei).
  - Built-in symbol resolution for ETH, USDC, CELO, and cUSD on supported chains.
- 🌉 **Cross-Chain Routing**: Specialized in capital movement between **Base** and **Celo**.
- 📊 **Multi-Chain Balance Tracking**: Custom `plugin-celo` and `plugin-evm` integration for real-time tracking of native and stablecoin assets.
- 🆔 **ENS Identity Management**: Full support for resolving `.eth` names and reverse-resolving addresses to ensure secure transactions.
- 🏦 **Stablecoin Prioritization**: Thinks and operates in USDC and cUSD to minimize volatility markers.

## 🏆 Synthesis Hackathon Submission

This project is registered for the **Synthesis Hackathon**. 

- **Agent Name**: Etherland Trader
- **Primary Goal**: Showcase autonomous capital management and cross-chain execution using the ElizaOS framework.
- **Synthesis API Integration**: Leverages the Synthesis platform for agent identity and hackathon verification.

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v23+)
- [bun](https://bun.sh/)
- **Uniswap API Key**: Required for the `plugin-uniswap` to fetch quotes.
- **EVM Private Key**: For transaction signing and execution.

### Installation

```bash
# Clone the repository
git clone https://github.com/Bleyle823/Etherland2.git
cd Etherland2/eliza-main

# Install dependencies
bun install

# Build the custom plugins
bun run build
```

### Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Key variables:
- `EVM_PRIVATE_KEY`: Your wallet's private key.
- `UNISWAP_API_KEY`: Your Uniswap Trading API key.
- `SYNTHESIS_API_KEY`: Your Synthesis Hackathon API key.
- `ANTHROPIC_API_KEY`: For the Claude 3.5 Sonnet / Haiku brain.

### Running the Trader

Start the Etherland Trader character:

```bash
bun packages/cli/dist/index.js start --character=characters/trader.character.json
```

---

## 🔌 Custom Plugins & Developer Impact

These plugins are fully functional and designed to be open-source contributions. They will directly assist developers building with these respective tools in the future by providing seamless, out-of-the-box integrations for the ElizaOS ecosystem.

### 1. `plugin-uniswap`
**Why it's needed:** Currently, there is no dedicated, fully-featured Eliza plugin for Uniswap. 
**Benefit to the Protocol:** This plugin resolves that gap by wrapping the Uniswap Trading API into the AI agent ecosystem. It autonomously handles token resolution, `GET_QUOTE` fetching across Uniswap v2/v3/UniswapX, and safe `EXECUTE_SWAP` generation via Viem. By providing this missing infrastructure, it empowers future AI developers to build trading bots, yield optimizers, and automated portfolios natively on Uniswap, driving autonomous trade volume and deep integration into the protocol.

### 2. `plugin-ens`
**Why it's needed:** AI agents and users alike struggle with raw 42-character hex addresses, leading to unreadable logs and error-prone transfers.
**Benefit to the Protocol:** This functional plugin integrates the Ethereum Name Service directly into the agent's cognition, allowing it to natively resolve `.eth` names and perform reverse lookups. This makes agent operations human-readable and secure. For the ENS protocol, this standardizes ENS as the foundational identity layer for the growing machine-to-machine and machine-to-human autonomous economy.

### 3. `plugin-celo`
**Why it's needed:** Celo's unique mobile-first, stablecoin-centric architecture (like fee abstraction) requires tailored agentic tools that generalized EVM plugins often miss.
**Benefit to the Protocol:** This plugin provides essential Celo-specific actions, including specialized multi-token balance reading (CELO, cUSD), Aave lending/borrowing integration, and ERC20 gas payment abstractions. By simplifying these Celo-native features into simple natural language commands, it reduces friction for future builders, positioning Celo as a premier network for AI agents and driving automated DeFi activity onto the chain.

---

## 🤝 Architecture

Etherland Trader leverages a modular architecture:
- **Core**: ElizaOS Framework.
- **Logic**: Custom actions for trading and capital routing.
- **Identity**: ENS and Synthesis API.
- **Provider**: Real-time balance and gas tracking via Viem.

## 📜 License

This project is licensed under the MIT License.

---

<div align="center">
  <p>Built with ❤️ for the Synthesis Hackathon by early adopters of ElizaOS.</p>
</div>
