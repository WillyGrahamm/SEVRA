import React, { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { ethers } from 'ethers';
import { Buffer } from "buffer";
window.Buffer = Buffer;
import backend from './backend';
import {
  EthereumClient,
  w3mConnectors,
  w3mProvider,
} from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/react';
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';

// Import styles
import './styles3.css';

// WalletConnect configuration
const projectId = '91998171939137f7f0fdc439ed1effac';
const chains = [mainnet, sepolia];

const { publicClient } = configureChains(chains, [w3mProvider({ projectId })]);

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: w3mConnectors({ projectId, chains }),
  publicClient
});
console.log("WagmiConfig Loaded:", wagmiConfig);

const ethereumClient = new EthereumClient(wagmiConfig, chains);

// Main App component
export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        localStorage.setItem('firebaseUser', JSON.stringify(firebaseUser));
      } else {
        const storedUser = localStorage.getItem('firebaseUser');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      }
    });
    
    // Initialize script3.js functionality
    const script = document.createElement('script');
    script.src = 'script3.js';
    script.defer = true;
    document.body.appendChild(script);
    
    return () => {
      unsubscribe();
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      localStorage.setItem("firebaseUser", JSON.stringify(result.user));
      const initResult = await backend.initializeUser(result.user.uid);
      console.log("Initialize user after sign-in:", initResult); // Log hasil inisialisasi
      setRefreshTrigger(prev => prev + 1); // Trigger refresh setelah login
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  return (
    <>
      <WagmiConfig config={wagmiConfig}>
        <SevraApp user={user} signInWithGoogle={signInWithGoogle} />
      </WagmiConfig>
      
      <Web3Modal 
        projectId={projectId}
        ethereumClient={ethereumClient}
      />
    </>
  );
}

// Child component with SEVRA Finance HTML layout integrated with Wagmi hooks
function SevraApp({ user, signInWithGoogle }) {
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const [artworks, setArtworks] = useState([]);
  const [balance, setBalance] = useState({ sevBalance: 0, usdtBalance: 0 });
  const [artTokenBalances, setArtTokenBalances] = useState({});
  const [orderBook, setOrderBook] = useState({ buyOrders: [], sellOrders: [] });
  const [usdtAmount, setUsdtAmount] = useState(0);
  const [walletAddress, setWalletAddress] = useState('');
  const [tradingWindow, setTradingWindow] = useState({
    isOpen: false,
    currentWindow: null,
    nextWindow: null
  });
  const [transactionDetails, setTransactionDetails] = useState({
    artworkId: '',
    amount: 1,
    price: 0,
    isBuying: true
  });
  const [activeContainer, setActiveContainer] = useState('container1');
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to safely convert BigInt to Number without mixing types
  const safeConvertBigInt = (value) => {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    return value;
  };

  // Function to ensure all numeric values are regular numbers, not BigInt
  const normalizeData = (data) => {
    if (data === null || data === undefined) {
      console.log("Data is null or undefined, returning default");
      return { sevBalance: 0, usdtBalance: 0, artTokens: [], buyOrders: [], sellOrders: [] };
    }
    if (Array.isArray(data)) {
      return data.map(normalizeData);
    } else if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
      const normalized = {};
      for (const key in data) {
        normalized[key] = normalizeData(data[key]);
      }
      return normalized;
    } else if (typeof data === 'bigint') {
      return Number(data);
    }
    return data;
  };

  const fetchUserData = async () => {
    if (!user || !address) {
      console.log("User or address not available, skipping fetchUserData");
      return;
    }
    try {
      console.log("Fetching user balance for UID:", user.uid);
      let userData = await backend.getUserBalance(user.uid);
      console.log("Raw user data from backend:", userData);
  
      if (!userData) {
        console.log("User data not found, initializing user...");
        const initResult = await backend.initializeUser(user.uid);
        console.log("Initialize user result:", initResult);
        userData = await backend.getUserBalance(user.uid);
        console.log("User data after initialization:", userData);
      }
  
      if (userData) {
        const normalizedData = normalizeData(userData);
        console.log("Normalized user data:", normalizedData);
        const newBalance = {
          sevBalance: normalizedData.sevBalance !== undefined ? Number(normalizedData.sevBalance) : 0,
          usdtBalance: normalizedData.usdtBalance !== undefined ? Number(normalizedData.usdtBalance) : 0,
        };
        console.log("Setting new balance:", newBalance);
        setBalance(newBalance);
        console.log("Balance state after setBalance:", balance); // Log state setelah setBalance
        setArtTokenBalances(
          normalizedData.artTokens
            ? normalizedData.artTokens.reduce((acc, [id, amount]) => {
                acc[id] = amount;
                return acc;
              }, {})
            : {}
        );
        setWalletAddress(address);
      } else {
        console.log("No user data returned after initialization, setting default balance");
        setBalance({ sevBalance: 0, usdtBalance: 0 });
        setArtTokenBalances({});
        setWalletAddress(address);
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      setBalance({ sevBalance: 0, usdtBalance: 0 });
      setArtTokenBalances({});
      setWalletAddress(address);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [user, address, refreshTrigger]);

  useEffect(() => {
    console.log("Balance state updated:", balance);
  }, [balance]);
  
  const fetchTradingWindow = async () => {
    try {
      let windowStatus = await backend.getTradingWindowStatus();
      // Normalize to ensure no BigInt values
      windowStatus = normalizeData(windowStatus);
      
      setTradingWindow(windowStatus || { 
        isOpen: false, 
        currentWindow: null, 
        nextWindow: null 
      });
    } catch (error) {
      console.error("Error fetching trading window status:", error);
      setTradingWindow({ 
        isOpen: false, 
        currentWindow: null, 
        nextWindow: null 
      });
    }
  };

  const fetchData = async () => {
    try {
      // Fetch artworks
      let result = await backend.getArtworks();
      result = normalizeData(result);
      console.log("Fetched artworks:", result);
      setArtworks(Array.isArray(result) ? result : []);
  
      // Fetch trading window status
      await fetchTradingWindow();
  
      // Fetch user balance
      if (user && address) {
        await fetchUserData(); // Pastikan fetchUserData dipanggil
      }
  
      // Fetch order book
      const activeArtworkId = transactionDetails.artworkId || (result[0]?.id || "UTD");
      console.log("Fetching order book for artwork ID:", activeArtworkId);
      let orderBookData = await backend.getOrderBook(activeArtworkId);
      orderBookData = normalizeData(orderBookData);
      console.log("Fetched order book:", orderBookData);
      setOrderBook(orderBookData || { buyOrders: [], sellOrders: [] });
    } catch (error) {
      console.error("ERROR - Fetching Data:", error);
      setArtworks([]);
      setOrderBook({ buyOrders: [], sellOrders: [] });
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, address, refreshTrigger]);

  useEffect(() => {
    if (user && address) {
      fetchUserData();
    }
  }, [user, address]);

  useEffect(() => {
    if (user) {
      console.log("Current user UID in React:", user.uid);
    }
  }, [user]);
  
  useEffect(() => {
    fetchData();

    // Clock update for analog clock
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours() % 12;
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      
      const hourHand = document.querySelector('.hour-hand');
      const minuteHand = document.querySelector('.minute-hand');
      const secondHand = document.querySelector('.second-hand');
      
      if (hourHand && minuteHand && secondHand) {
        const hourDeg = (hours * 30) + (minutes * 0.5);
        const minuteDeg = (minutes * 6) + (seconds * 0.1);
        const secondDeg = seconds * 6;
        
        hourHand.style.transform = `rotate(${hourDeg}deg)`;
        minuteHand.style.transform = `rotate(${minuteDeg}deg)`;
        secondHand.style.transform = `rotate(${secondDeg}deg)`;
      }
    };
    
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);
    
    return () => clearInterval(clockInterval);
  }, [refreshTrigger]);

  // Set initial artwork when artworks are loaded
  useEffect(() => {
    if (artworks.length > 0 && !transactionDetails.artworkId) {
      setTransactionDetails(prev => ({
        ...prev,
        artworkId: artworks[0].id,
        price: artworks[0].currentPrice
      }));
    }
  }, [artworks]);

  const handlePlaceOrder = async (artworkId, amount, price, isBuying = true) => {
    if (!user) {
      alert("Please login first");
      return;
    }
    if (!isTradeAllowed()) {
      const nextWindowTime = tradingWindow?.nextWindow
        ? formatWindowTime(tradingWindow.nextWindow)
        : "Not available";
      alert(`Trading is currently closed. Next window: ${nextWindowTime}`);
      return;
    }
  
    try {
      const orderType = isBuying ? { Buy: null } : { Sell: null };
      const result = await backend.placeOrder(user.uid, artworkId, orderType, amount, price);
      console.log("Place order result:", result); // Log hasil
      if (result.ok) {
        alert(`${isBuying ? "Buy" : "Sell"} order placed successfully!`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        alert(`Error: ${result.err || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error placing order:", error);
      alert(`Error placing order: ${error.message || "Unknown error"}`);
    }
  };

  const isTradeAllowed = () => {
    return tradingWindow?.isOpen || false;
  };

  const formatWindowTime = (window) => {
    if (!window || !Array.isArray(window) || window.length < 2) {
      return 'Not available';
    }
    try {
      const start = String(window[0]).padStart(2, '0') || '00';
      const end = String(window[1]).padStart(2, '0') || '00';
      return `${start}:00 - ${end}:00`;
    } catch (error) {
      console.error("Error formatting window time:", error);
      return 'Not available';
    }
  };

  const handleTopUp = async (amount) => {
    if (!user) {
      alert("Please login first!");
      return;
    }
    const parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) {
      alert("Please enter a valid amount!");
      return;
    }

    try {
      const result = await backend.topUpUSDT(user.uid, parsedAmount);
      console.log("Top up result:", result); // Log hasil
      if (result.ok) {
        alert("Top up successful!");
        setRefreshTrigger(prev => prev + 1);
        setUsdtAmount(0);
      } else {
        alert(`Top up failed: ${result.err || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error during top up:", error);
      alert(`Top up failed: ${error.message || "Unknown error"}`);
    }
  };

  const handleConvert = async () => {
    if (!user) {
      alert("Please login first");
      return;
    }
    const parsedAmount = parseFloat(usdtAmount) || 0;
    if (parsedAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }
  
    try {
      const result = await backend.convertUSDTtoSEV(user.uid, parsedAmount);
      console.log("Convert result:", result); // Log hasil
      if (result.ok) {
        alert("Conversion successful!");
        setRefreshTrigger(prev => prev + 1);
        setUsdtAmount(0);
      } else {
        alert(`Error: ${result.err || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error during conversion:", error);
      alert(`Error processing conversion: ${error.message || "Unknown error"}`);
    }
  };
  
  const handleTransactionChange = (e) => {
    const { name, value } = e.target;
    setTransactionDetails(prev => ({
      ...prev,
      [name]: name === 'amount' || name === 'price' ? parseFloat(value) || 0 : value,
    }));
  };
  
  const handleTransactionTypeToggle = (isBuying) => {
    setTransactionDetails(prev => ({
      ...prev,
      isBuying
    }));
  };

  const switchContainer = (container) => {
    setActiveContainer(container);
  };

  const showMarketContent = (contentId) => {
    console.log("Showing market content for:", contentId); // Log untuk debugging
    setSelectedMarket(prev => (prev === contentId ? null : contentId)); // Toggle visibility
  };

  const connectWallet = () => {
    open();
  };

  return (
    <div style={{ backgroundColor: "black" }}>
      {/* Nav Bar */}
      <nav className="navbar">
        <a href="#" className="logo" onClick={() => switchContainer('container1')}>
          <img src="Images/logo2.png" alt="Sevra Logo" />
          <span>SEVRA</span>
        </a>
        
        <div className="nav-center">
        <button className="nav-button" data-target="container2" onClick={() => switchContainer('container2')}>ASSETS</button>
          <button className="nav-button">INVEST</button>
          <button className="nav-button">ABOUT</button>
        </div>

        <button className="connect-wallet" onClick={connectWallet}>
          {isConnected ? 'CHANGE WALLET' : 'CONNECT WALLET'}
        </button>
      </nav>

      {/* Container 1: Login and Connect Wallet with Video Background */}
      {activeContainer === 'container1' && (
        <div id="container1">
          <div className="interactive-ball" id="interactive-ball"></div>
          <div className="overlay"></div>

          <div className="title">SEVRA FINANCE</div>
          <div className="login-panel">
            <h2>Trading Platform</h2>
            <div className="button-container">
              <button className="button login-button" onClick={signInWithGoogle}>
                {user ? `Logged in as: ${user.email}` : 'Login with Google'}
              </button>
              <button className="button wallet-button" onClick={connectWallet}>
                {isConnected ? `Connected: ${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Connect Wallet'}
              </button>
            </div>
          </div>

          <div className="arrow-down" onClick={() => switchContainer('container2')}>
            &#9660;
          </div>
        </div>
      )}

      {/* Container 2: Dashboard (Left and Right Sides) */}
      {activeContainer === 'container2' && (
        <div id="container2">
          <div className="dashboard-top">
          <div className="interactive-ball" id="interactive-ball-container2"></div>
            {/* User Data (Left Top) */}
            <div className="user-data">
              <h2>Your Portfolio</h2>
              <div className="data-row">
                <span>SEV Balance:</span>
                <span>{Number(balance.sevBalance).toLocaleString()} SEV</span>
              </div>

              <div className="data-row">
                <span>USDT Balance:</span>
                <span>{Number(balance.usdtBalance).toLocaleString()} USDT</span>
              </div>

              <div className="data-row">
                <span>Wallet Address:</span>
                <span>{isConnected ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Not connected'}</span>
              </div>
            </div>

            {/* Market Time Panel (Right Top) */}
            <div className="market-panel">
              <h2>Trading Window Status</h2>
              <div className="panel-layout">
                <div className="clock-container">
                  <div className="analog-clock">
                    <div className="clock-face">
                      <div className="hand hour-hand"></div>
                      <div className="hand minute-hand"></div>
                      <div className="hand second-hand"></div>
                      <div className="center-dot"></div>
                    </div>
                  </div>
                </div>
                
                <div className="status-container">
                  <div className="data-row">
                    <span>Status:</span>
                    <span className={`status ${tradingWindow.isOpen ? 'status-open' : 'status-closed'}`}>
                      {tradingWindow.isOpen ? 'Trading Open' : 'Trading Closed'}
                    </span>
                  </div>
                  <div className="data-row">
                    <span>Current Window:</span>
                    <span>
                      {tradingWindow.currentWindow 
                        ? formatWindowTime(tradingWindow.currentWindow) 
                        : 'Not available'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          
            {user && isConnected && (
              <div className="management-panel">
                <h3>Manage Your Funds</h3>
                <div className="management-controls">
                  <input
                    type="number"
                    value={usdtAmount || ""}
                    onChange={(e) => setUsdtAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    placeholder="USDT Amount"
                    min="0"
                    step="0.01"
                  />
                  <button onClick={() => handleTopUp(usdtAmount)} disabled={!usdtAmount || usdtAmount <= 0}>
                    Top Up USDT
                  </button>
                  <button onClick={handleConvert} disabled={!usdtAmount || usdtAmount <= 0}>
                    Convert to SEV
                  </button>
                </div>
                <div className="note">1 SEV = 5 USDT. SEV is used for trading artwork tokens.</div>
              </div>
            )}
          </div>
      
          {/* Artwork Markets - Using real data from artworks state */}
          <div className="market-buttons-container">
            <h2 className="market-buttons-title">Artwork Markets</h2>
            {artworks.map((artwork) => (
              <div className="market-item" key={artwork.id}>
                <button
                  className={`market-button ${selectedMarket === artwork.id ? 'expanded' : ''}`}
                  onClick={() => {
                    showMarketContent(artwork.id);
                    setTransactionDetails(prev => ({
                      ...prev,
                      artworkId: artwork.id,
                      price: artwork.currentPrice,
                    }));
                  }}
                  data-content-id={artwork.id}
                >
                  {artwork.name} - {artwork.symbol}
                </button>
                <div
                  id={artwork.id}
                  className={`market-content ${selectedMarket === artwork.id ? 'active' : ''}`}
                >
                  <h3>{artwork.name} Market</h3>
                  <p>{artwork.description || 'No description available'}. Current market cap: {(Number(artwork.currentPrice) * Number(artwork.totalSupply)).toLocaleString()} USDT.</p>
                  <div className="market-stats">
                    <div className="stat-item">
                      <span>Current Price:</span>
                      <span>{Number(artwork.currentPrice).toLocaleString()} USDT</span>
                    </div>
                    {artwork.lastPrice && (
                      <div className="stat-item">
                        <span>Price Change:</span>
                        <span className={Number(artwork.currentPrice) > Number(artwork.lastPrice) ? 'positive' : 'negative'}>
                          {Number(artwork.currentPrice) > Number(artwork.lastPrice) ? '+' : ''}
                          {((Number(artwork.currentPrice) - Number(artwork.lastPrice)) / Number(artwork.lastPrice) * 100).toFixed(2)}%
                        </span>
                      </div>
                    )}
                    <div className="stat-item">
                      <span>Total Supply:</span>
                      <span>{Number(artwork.totalSupply).toLocaleString()}</span>
                    </div>
                    <div className="trading-controls">
                      <input
                        type="number"
                        name="amount"
                        value={transactionDetails.artworkId === artwork.id ? transactionDetails.amount : 1}
                        onChange={handleTransactionChange}
                        placeholder="Amount"
                        min="0.01"
                        step="0.01"
                      />
                      <div className="trading-buttons">
                        <button
                          className="buy-button"
                          onClick={() => handlePlaceOrder(
                            artwork.id,
                            transactionDetails.amount,
                            artwork.currentPrice,
                            true
                          )}
                          disabled={!user || !isConnected || !isTradeAllowed()}
                        >
                          Buy
                        </button>
                        <button
                          className="sell-button"
                          onClick={() => handlePlaceOrder(
                            artwork.id,
                            transactionDetails.amount,
                            artwork.currentPrice,
                            false
                          )}
                          disabled={!user || !isConnected || !isTradeAllowed() || !artTokenBalances[artwork.id]}
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* If no artworks are loaded yet, show placeholders */}
            {artworks.length === 0 && (
              <>
                <div className="market-item">
                  <button className="market-button" onClick={() => showMarketContent('loading')}>
                    Loading markets...
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}     

// Don't forget to import these hooks in the child component
import { useWeb3Modal } from '@web3modal/react';
import { useAccount } from 'wagmi';