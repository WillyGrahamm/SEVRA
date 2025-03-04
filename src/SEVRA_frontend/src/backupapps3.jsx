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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        localStorage.setItem('firebaseUser', JSON.stringify(firebaseUser));
        // Initialize user after sign-in
        const initializeUserOnAuth = async () => {
          try {
            const initResult = await backend.initializeUser(firebaseUser.uid);
            console.log("Initialize user on auth change:", initResult);
            setRefreshTrigger(prev => prev + 1);
          } catch (error) {
            console.error("Failed to initialize user on auth change:", error);
          }
        };
        initializeUserOnAuth();
      } else {
        const storedUser = localStorage.getItem('firebaseUser');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      }
    });
    
    // Add particles.js script
    const particlesScript = document.createElement('script');
    particlesScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/particles.js/2.0.0/particles.min.js';
    particlesScript.async = true;
    document.body.appendChild(particlesScript);
    
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
      if (document.body.contains(particlesScript)) {
        document.body.removeChild(particlesScript);
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      localStorage.setItem("firebaseUser", JSON.stringify(result.user));
      const initResult = await backend.initializeUser(result.user.uid);
      console.log("Initialize user after sign-in:", initResult);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  return (
    <>
      <WagmiConfig config={wagmiConfig}>
        <SevraApp user={user} signInWithGoogle={signInWithGoogle} refreshTrigger={refreshTrigger} setRefreshTrigger={setRefreshTrigger} />
      </WagmiConfig>
      
      <Web3Modal 
        projectId={projectId}
        ethereumClient={ethereumClient}
      />
    </>
  );
}

// Child component with SEVRA Finance HTML layout integrated with Wagmi hooks
function SevraApp({ user, signInWithGoogle, refreshTrigger, setRefreshTrigger }) {
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const [artworks, setArtworks] = useState([]);
  const [balance, setBalance] = useState({ sevBalance: 0, usdtBalance: 0 });
  const [artTokenBalances, setArtTokenBalances] = useState({});
  const [orderBook, setOrderBook] = useState({ buyOrders: [], sellOrders: [] });
  const [usdtAmount, setUsdtAmount] = useState("");
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
  const [isInitialized, setIsInitialized] = useState(false);

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

  const initializeUserData = async () => {
    if (!user) {
      console.log("No user available, skipping initialization");
      return;
    }
    
    try {
      console.log("Initializing user data for UID:", user.uid);
      const initResult = await backend.initializeUser(user.uid);
      console.log("Initialize user result:", initResult);
      setIsInitialized(true);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Failed to initialize user:", error);
    }
  };

  const fetchUserData = async () => {
    if (!user) {
      console.log("No user available, skipping fetchUserData");
      return;
    }
    
    try {
      console.log("Fetching user balance for UID:", user.uid);
      let userData = await backend.getUserBalance(user.uid);
      console.log("Raw user data from backend:", userData);
  
      if (!userData) {
        console.log("User data not found, initializing user...");
        await initializeUserData();
        userData = await backend.getUserBalance(user.uid);
        console.log("User data after initialization:", userData);
      }
  
      if (userData) {
        // Force deep clone to break reference and ensure state update
        const normalizedData = JSON.parse(JSON.stringify(normalizeData(userData)));
        console.log("Normalized user data:", normalizedData);
        
        // Create new objects for state updates to ensure React detects the change
        const newBalance = {
          sevBalance: normalizedData.sevBalance !== undefined ? Number(normalizedData.sevBalance) : 0,
          usdtBalance: normalizedData.usdtBalance !== undefined ? Number(normalizedData.usdtBalance) : 0,
        };
        
        console.log("Setting new balance:", newBalance);
        setBalance(newBalance);
        
        const newArtTokenBalances = normalizedData.artTokens
          ? normalizedData.artTokens.reduce((acc, [id, amount]) => {
              acc[id] = Number(amount);
              return acc;
            }, {})
          : {};
        
        setArtTokenBalances(newArtTokenBalances);
        setWalletAddress(address || '');
      } else {
        console.log("No user data returned, setting default balance");
        setBalance({ sevBalance: 0, usdtBalance: 0 });
        setArtTokenBalances({});
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      setBalance({ sevBalance: 0, usdtBalance: 0 });
      setArtTokenBalances({});
    }
  };

  useEffect(() => {
    if (user && !isInitialized) {
      initializeUserData();
    }
  }, [user]);

  useEffect(() => {
    console.log("React component re-rendered with refresh trigger:", refreshTrigger);
    if (user) {
      fetchUserData();
      fetchData();
    }
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
    if (!user) {
      console.log("No user available, skipping fetchData");
      return;
    }
    
    try {
      // Fetch artworks
      let result = await backend.getArtworks();
      result = normalizeData(result);
      console.log("Fetched artworks:", result);
      setArtworks(Array.isArray(result) ? result : []);
  
      // Fetch trading window status
      await fetchTradingWindow();
  
      // Fetch user balance
      await fetchUserData();
  
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
    // Initialize particles.js when component mounts and activeContainer is 'container1'
    if (activeContainer === 'container1') {
      const initParticles = () => {
        if (window.particlesJS && document.getElementById('particles-js')) {
          window.particlesJS('particles-js', {
            particles: {
              number: { value: 80, density: { enable: true, value_area: 800 } },
              color: { value: "#00ffff" },
              shape: { type: "circle" },
              opacity: { value: 0.5, random: false },
              size: { value: 3, random: true },
              line_linked: {
                enable: true,
                distance: 150,
                color: "#00ffff",
                opacity: 0.4,
                width: 1
              },
              move: {
                enable: true,
                speed: 2,
                direction: "none",
                random: false,
                straight: false,
                out_mode: "out",
                bounce: false
              }
            },
            interactivity: {
              detect_on: "canvas",
              events: {
                onhover: { enable: true, mode: "repulse" },
                onclick: { enable: true, mode: "push" }
              },
              modes: {
                repulse: { distance: 100, duration: 0.4 },
                push: { particles_nb: 4 }
              }
            }
          });
        }
      };

      // Check if particlesJS is loaded
      if (window.particlesJS) {
        initParticles();
      } else {
        // Wait for particlesJS to load
        const checkParticles = setInterval(() => {
          if (window.particlesJS) {
            clearInterval(checkParticles);
            initParticles();
          }
        }, 100);
      }
    }

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
  }, [activeContainer]);

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
      console.log(`Placing ${isBuying ? 'BUY' : 'SELL'} order for artwork: ${artworkId}, amount: ${amount}, price: ${price}`);
      const orderType = isBuying ? { Buy: null } : { Sell: null };
      const result = await backend.placeOrder(user.uid, artworkId, orderType, amount, price);
      console.log("Place order result:", result);
      
      if (result && result.ok) {
        alert(`${isBuying ? "Buy" : "Sell"} order placed successfully!`);
        
        // Force a hard refresh of user data and rerender
        setTimeout(async () => {
          await fetchUserData();
          await fetchData();
          setRefreshTrigger(prev => prev + 1);
        }, 500);
      } else {
        const errorMsg = result && result.err ? result.err : "Unknown error";
        alert(`Error: ${errorMsg}`);
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
      console.log(`Topping up USDT: ${parsedAmount} for user: ${user.uid}`);
      const result = await backend.topUpUSDT(user.uid, parsedAmount);
      console.log("Top up result:", result);
      
      if (result && result.ok) {
        alert("Top up successful!");
        setUsdtAmount("");
        
        // Force refresh after top up
        setTimeout(async () => {
          await fetchUserData();
          setRefreshTrigger(prev => prev + 1);
        }, 500);
      } else {
        const errorMsg = result && result.err ? result.err : "Unknown error";
        alert(`Top up failed: ${errorMsg}`);
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
      console.log(`Converting USDT to SEV: ${parsedAmount} for user: ${user.uid}`);
      const result = await backend.convertUSDTtoSEV(user.uid, parsedAmount);
      console.log("Convert result:", result);
      
      if (result && result.ok) {
        alert("Conversion successful!");
        setUsdtAmount("");
        
        // Force refresh after conversion
        setTimeout(async () => {
          await fetchUserData();
          setRefreshTrigger(prev => prev + 1);
        }, 500);
      } else {
        const errorMsg = result && result.err ? result.err : "Unknown error";
        alert(`Error: ${errorMsg}`);
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
    console.log("Showing market content for:", contentId);
    setSelectedMarket(prev => (prev === contentId ? null : contentId));
    
    // If selecting a market, update transaction details
    if (contentId && contentId !== selectedMarket) {
      const artwork = artworks.find(art => art.id === contentId);
      if (artwork) {
        setTransactionDetails(prev => ({
          ...prev,
          artworkId: artwork.id,
          price: artwork.currentPrice,
        }));
      }
    }
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
          <div id="particles-js"></div>
          <div id="mouse-follower"></div>
        </div>
      )}

      {/* Container 2: Dashboard (Left and Right Sides) */}
      {activeContainer === 'container2' && (
        <div id="container2">
          <div className="dashboard-top">
            {/* User Data (Left Top) */}
            <div className="user-data">
              <h2>Your Portfolio</h2>
              <div className="data-row">
                <span>SEV Balance:</span>
                <span>{balance.sevBalance.toLocaleString()} SEV</span>
              </div>

              <div className="data-row">
                <span>USDT Balance:</span>
                <span>{balance.usdtBalance.toLocaleString()} USDT</span>
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
            
              {user && isConnected && (
                <div className="management-panel">
                  <h3>Manage Your Funds</h3>
                  <div className="management-controls">
                    <input
                      type="number"
                      value={usdtAmount}
                      onChange={(e) => setUsdtAmount(e.target.value)}
                      placeholder="USDT Amount"
                      min="0"
                      step="0.01"
                    />
                    <button 
                      onClick={() => handleTopUp(usdtAmount)} 
                      disabled={!usdtAmount || parseFloat(usdtAmount) <= 0}
                    >
                      Top Up USDT
                    </button>
                    <button 
                      onClick={handleConvert} 
                      disabled={!usdtAmount || parseFloat(usdtAmount) <= 0}
                    >
                      Convert to SEV
                    </button>
                  </div>
                  <div className="note">1 SEV = 5 USDT. SEV is used for trading artwork tokens.</div>
                </div>
              )}
            </div>
          </div>
      
          {/* Artwork Markets - Using real data from artworks state */}
          <div className="market-buttons-container">
            <h2 className="market-buttons-title">Artwork Markets</h2>
            {artworks.length > 0 ? (
              artworks.map((artwork) => (
                <div className="market-item" key={artwork.id}>
                  <button
                    className={`market-button ${selectedMarket === artwork.id ? 'expanded' : ''}`}
                    onClick={() => showMarketContent(artwork.id)}
                    data-content-id={artwork.id}
                  >
                    {artwork.name} - {artwork.symbol}
                  </button>
                  <div
                    id={artwork.id}
                    className={`market-content ${selectedMarket === artwork.id ? 'active' : ''}`}
                  >
                    {/* Video background for market content */}
                    <video className="market-bg-video" autoPlay muted loop>
                      <source src="Videos/BDO.mp4" type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                    
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
                        {/* Slider for amount selection */}
                        <input 
                          type="range" 
                          name="amount"
                          value={transactionDetails.artworkId === artwork.id ? transactionDetails.amount : 1}
                          onChange={handleTransactionChange}
                          min="0.01" 
                          max="100" 
                          step="0.01" 
                          className="slider"
                        />
                        <span className="slider-value">
                          {transactionDetails.artworkId === artwork.id ? transactionDetails.amount : 1} = 
                          {((transactionDetails.artworkId === artwork.id ? transactionDetails.amount : 1) * artwork.currentPrice).toFixed(2)} USDT
                        </span>
                        
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
                            disabled={!user || !isConnected || !isTradeAllowed() || !(artTokenBalances[artwork.id] > 0)}
                          >
                            Sell
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="market-item">
                <button className="market-button">Loading markets...</button>
              </div>
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