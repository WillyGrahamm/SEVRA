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

const videoMap = {
  'UTD': 'Videos/UTD.mp4',
  'ORY': 'Videos/ORY.mp4',
  'BDO': 'Videos/BDO.mp4',
  'POL': 'Videos/POL.mp4',
  'LFA': 'Videos/LFA.mp4'
};

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
  const [tokenomics, setTokenomics] = useState({}); // State baru untuk tokenomics
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
      console.log("Normalizing array:", data);
      // Jika data adalah array dengan satu elemen opsional dari Motoko (misalnya [ {...} ])
      if (data.length === 1 && typeof data[0] === 'object') {
        return normalizeData(data[0]); // Unwrap optional
      }
      return data.map(item => normalizeData(item));
    } else if (typeof data === 'object' && !(data instanceof Date)) {
      console.log("Normalizing object:", data);
      const normalized = {};
      for (const key in data) {
        if (key === 'artTokens' && data[key]) {
          // Pastikan artTokens tetap array tuple
          if (Array.isArray(data[key])) {
            normalized[key] = data[key].map(([id, amount]) => [id, Number(amount)]);
          } else {
            console.warn(`Unexpected artTokens format: ${data[key]}`);
            normalized[key] = []; // Default ke array kosong jika format salah
          }
        } else {
          normalized[key] = normalizeData(data[key]);
        }
      }
      return normalized;
    } else if (typeof data === 'bigint') {
      return Number(data);
    }
    return data;
  };
  
  // Perbaiki fetchUserData
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
        const normalizedData = normalizeData(userData);
        console.log("Normalized user data:", normalizedData);
  
        const userObject = Array.isArray(normalizedData) ? normalizedData : normalizedData;
  
        const newBalance = {
          sevBalance: userObject.sevBalance !== undefined ? Number(userObject.sevBalance) : 0,
          usdtBalance: userObject.usdtBalance !== undefined ? Number(userObject.usdtBalance) : 0,
        };
        
        console.log("Setting new balance:", newBalance);
        setBalance(newBalance);
  
        const newArtTokenBalances = Array.isArray(userObject.artTokens)
          ? userObject.artTokens.reduce((acc, [id, amount]) => {
              if (amount > 0) acc[id] = Number(amount);
              return acc;
            }, {})
          : {};
        
        console.log("Setting new art token balances:", newArtTokenBalances);
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
  
  useEffect(() => {
    console.log("React component re-rendered with refresh trigger:", refreshTrigger);
    if (user) {
      fetchUserData();
      fetchData();
      if (user && isConnected && activeContainer !== 'container2') {
        console.log("User logged in and wallet connected, switching to container2");
        setActiveContainer('container2');
      }
    } else if (activeContainer !== 'container1') {
      console.log("No user, switching to container1");
      setActiveContainer('container1');
    }
  }, [user, isConnected, address, refreshTrigger]);

  const fetchTradingWindow = async () => {
    try {
      let windowStatus = await backend.getTradingWindowStatus();
      console.log("Unnormalized trading window status:", windowStatus); // Data asli dari Motoko
      windowStatus = normalizeData(windowStatus);
      console.log("Raw trading window status:", windowStatus);
      console.log("currentWindow details:", windowStatus.currentWindow, "Type:", typeof windowStatus.currentWindow, "Is array?", Array.isArray(windowStatus.currentWindow), "Length:", windowStatus.currentWindow?.length, "Value:", windowStatus.currentWindow);
      console.log("nextWindow details:", windowStatus.nextWindow, "Type:", typeof windowStatus.nextWindow, "Is array?", Array.isArray(windowStatus.nextWindow), "Length:", windowStatus.nextWindow?.length, "Value:", windowStatus.nextWindow);
  
      const defaultWindow = { isOpen: false, currentWindow: null, nextWindow: null };
      if (!windowStatus || typeof windowStatus !== 'object') {
        console.error("Invalid trading window data:", windowStatus);
        setTradingWindow(defaultWindow);
        return;
      }
  
      // Tangani tipe opsional ?[Nat] dengan lebih fleksibel
      const currentWindow = windowStatus.currentWindow === null || (Array.isArray(windowStatus.currentWindow) && windowStatus.currentWindow.length === 0)
        ? null
        : (Array.isArray(windowStatus.currentWindow) && windowStatus.currentWindow.length === 2 ? windowStatus.currentWindow : null);
      const nextWindow = windowStatus.nextWindow === null || (Array.isArray(windowStatus.nextWindow) && windowStatus.nextWindow.length === 0)
        ? null
        : (Array.isArray(windowStatus.nextWindow) && windowStatus.nextWindow.length >= 1 ? windowStatus.nextWindow : null);
  
      console.log("Processed Current Window:", currentWindow);
      console.log("Processed Next Window:", nextWindow);
      setTradingWindow({
        isOpen: windowStatus.isOpen || false,
        currentWindow,
        nextWindow
      });
    } catch (error) {
      console.error("Error fetching trading window status:", error);
      setTradingWindow({ isOpen: false, currentWindow: null, nextWindow: null });
    }
  };

  const fetchData = async () => {
    if (!user) {
        console.log("No user available, skipping fetchData");
        return;
    }
    
    try {
        let result = await backend.getArtworks();
        result = normalizeData(result);
        console.log("Fetched artworks:", result);
        setArtworks(Array.isArray(result) ? result : []);
        
        await fetchTradingWindow();
        await fetchUserData();
        
        const activeArtworkId = transactionDetails.artworkId || (result[0]?.id || "UTD");
        console.log("Fetching order book for artwork ID:", activeArtworkId);
        let orderBookData = await backend.getOrderBook(activeArtworkId);
        orderBookData = normalizeData(orderBookData); // Handle optional and BigInt
        console.log("Fetched raw order book:", orderBookData);

        // Process the flat array into buyOrders and sellOrders
        let processedOrderBook = { buyOrders: [], sellOrders: [] };
        if (orderBookData && Array.isArray(orderBookData)) {
            processedOrderBook = orderBookData.reduce((acc, order) => {
                const normalizedOrder = {
                    id: order.id,
                    user: order.user,
                    artworkId: order.artworkId,
                    amount: Number(order.amount),
                    price: Number(order.price),
                    timestamp: Number(order.timestamp),
                    status: order.status,
                    filledAmount: Number(order.filledAmount)
                };
                if (order.orderType.Buy) {
                    acc.buyOrders.push(normalizedOrder);
                } else if (order.orderType.Sell) {
                    acc.sellOrders.push(normalizedOrder);
                }
                return acc;
            }, { buyOrders: [], sellOrders: [] });
        } else {
            console.warn("Order book data is empty or invalid:", orderBookData);
        }

        console.log("Processed order book:", processedOrderBook);
        setOrderBook(processedOrderBook);

        // Fetch tokenomics for each artwork
        const tokenomicsData = {};
        for (const artwork of result) {
            let tokenomicsResult = await backend.getTokenomics(artwork.id);
            tokenomicsResult = normalizeData(tokenomicsResult);
            tokenomicsData[artwork.id] = tokenomicsResult || {};
        }
        setTokenomics(tokenomicsData);
    } catch (error) {
        console.error("ERROR - Fetching Data:", error);
        setArtworks([]);
        setOrderBook({ buyOrders: [], sellOrders: [] });
        setTokenomics({});
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

  // useEffect terpisah untuk mouse follower
  useEffect(() => {
    const follower = document.getElementById('mouse-follower');
    const moveFollower = (e) => {
      follower.style.left = `${e.clientX}px`;
      follower.style.top = `${e.clientY}px`;
      follower.style.opacity = '1';
    };

    window.addEventListener('mousemove', moveFollower);

    return () => {
      window.removeEventListener('mousemove', moveFollower);
    };
  }, []); 

  // Set initial artwork when artworks are loaded
  useEffect(() => {
    if (artworks.length > 0 && !transactionDetails.artworkId) {
      const maxBuy = balance.sevBalance / (artworks[0].currentPrice || 1);
      setTransactionDetails(prev => ({
        ...prev,
        artworkId: artworks[0].id,
        price: artworks[0].currentPrice,
        amount: Math.min(1, maxBuy) 
      }));
    }
  }, [artworks, balance]);

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
      const offsetWIB = 7; // WIB adalah GMT+7
      const startGMT = parseInt(window[0], 10);
      const endGMT = parseInt(window[1], 10);
  
      // Konversi ke WIB
      const startWIB = (startGMT + offsetWIB) % 24; // Modulo 24 untuk wrap-around
      const endWIB = (endGMT + offsetWIB) % 24;
  
      const start = String(startWIB).padStart(2, '0');
      const end = String(endWIB).padStart(2, '0');
      return `${start}:00 - ${end}:00 WIB`; // Tambahkan label "WIB" untuk kejelasan
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
    const newValue = parseFloat(value) || 0;
    const artwork = artworks.find(art => art.id === transactionDetails.artworkId);
    const scaleFactor = 1000000;
    const maxBuy = (balance.sevBalance / (artwork?.currentPrice || 1)) * scaleFactor || 1; // Minimal 1
    const maxSell = (artTokenBalances[transactionDetails.artworkId] || 0) * scaleFactor || 0;
  
    if (name === 'amount') {
      const clampedValue = Math.max(-maxSell, Math.min(maxBuy, newValue));
      console.log(`Slider: min=${-maxSell}, max=${maxBuy}, value=${clampedValue}`);
      setTransactionDetails(prev => ({
        ...prev,
        amount: Math.abs(clampedValue) / scaleFactor,
        isBuying: clampedValue >= 0
      }));
    }
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
    
    if (contentId && contentId !== selectedMarket) {
      const artwork = artworks.find(art => art.id === contentId);
      if (artwork) {
        const scaleFactor = 1000000;
        const maxSell = (artTokenBalances[contentId] || 0) * scaleFactor;
        const maxBuy = (balance.sevBalance / (artwork.currentPrice || 1)) * scaleFactor;
        setTransactionDetails(prev => ({
          ...prev,
          artworkId: artwork.id,
          price: artwork.currentPrice,
          amount: maxSell > 0 ? 0 : Math.min(1, maxBuy) / scaleFactor,
          isBuying: maxSell === 0
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
          <button className="nav-button" onClick={() => window.location.href = '/sevra_webpage.html'}>HOME</button>
          <button className="nav-button" onClick={() => window.location.href = '/sevra_asset.html'}>ASSETS</button>
          <button className="nav-button" onClick={() => window.open('https://sevra-finance.gitbook.io/sevra_ff/', '_blank')}>ABOUT</button>
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
            <h2>Main Platform</h2>
            <div className="button-container">
              <button className="button login-button" onClick={signInWithGoogle}>
                {user ? `Logged in as: ${user.email}` : 'Login with Google'}
              </button>
              <button className="button wallet-button" onClick={connectWallet}>
                {isConnected ? `Connected: ${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Connect Wallet'}
              </button>
            </div>
          </div>

          <div 
            className="arrow-down" 
            onClick={() => (user && isConnected ? switchContainer('container2') : null)}
            style={{ cursor: user && isConnected ? 'pointer' : 'not-allowed', opacity: user && isConnected ? 1 : 0.5 }}
          >
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
              {Object.entries(artTokenBalances).map(([artworkId, amount]) => (
              <div className="data-row" key={artworkId}>
                <span>{artworkId} Balance:</span>
                <span>{amount.toLocaleString()}</span>
              </div>
            ))}
              <div className="data-row">
                <span>Wallet Address:</span>
                <span>{isConnected ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Not connected'}</span>
              </div>
            </div>

            {/* Market Time Panel (Right Top) */}
            <div className="market-panel">
              <h2>Main Window Status</h2>
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
                  <div className="data-row">
                    <span>Next Window:</span>
                    <span>
                      {tradingWindow.nextWindow 
                        ? formatWindowTime(tradingWindow.nextWindow) 
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
                            <video className="market-bg-video" autoPlay muted loop>
                                <source src={videoMap[artwork.id]} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                            <h3>{artwork.name} Market</h3>
                            <p>{artwork.description}. Current market cap: {(Number(artwork.currentPrice) * Number(artwork.totalSupply)).toLocaleString()} SEV.</p>
                            <div className="market-stats">
                                <div className="stat-item">
                                    <span>Current Price:</span>
                                    <span>{Number(artwork.currentPrice).toLocaleString()} SEV</span>
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
                                {/* Tampilan Tokenomics */}
                                {tokenomics[artwork.id] && (
                                    <div className="tokenomics-item">
                                        <span>Tokenomics:</span>
                                        <div>
                                            <span>Circulating: {(tokenomics[artwork.id].circulatingSupply || 0).toLocaleString()}</span>
                                            <span>Burned: {(tokenomics[artwork.id].burnedSupply || 0).toLocaleString()}</span>
                                            <span>Market Cap: {(tokenomics[artwork.id].marketCap || 0).toLocaleString()} SEV</span>
                                            <span>24h Volume: {(tokenomics[artwork.id].volume24h || 0).toLocaleString()} SEV</span>
                                        </div>
                                    </div>
                                )}
                                <div className="trading-controls">
                                    <input 
                                        type="range" 
                                        name="amount"
                                        value={transactionDetails.artworkId === artwork.id ? (transactionDetails.amount * (transactionDetails.isBuying ? 1 : -1) * 1000000) : 0}
                                        onChange={handleTransactionChange}
                                        min={-(artTokenBalances[artwork.id] || 0) * 1000000}
                                        max={balance.sevBalance / (artwork.currentPrice || 1) * 1000000}
                                        step="0.01"
                                        className="slider"
                                    />
                                    <span className="slider-value">
                                        {transactionDetails.isBuying ? 'Buy' : 'Sell'}: 
                                        {transactionDetails.artworkId === artwork.id ? transactionDetails.amount : 0} = 
                                        {((transactionDetails.artworkId === artwork.id ? transactionDetails.amount : 0) * artwork.currentPrice).toFixed(2)} SEV
                                    </span>
                                    <div className="trading-buttons">
                                        <button
                                            className="buy-button"
                                            onClick={() => handlePlaceOrder(artwork.id, transactionDetails.amount, artwork.currentPrice, true)}
                                            disabled={!user || !isConnected || !isTradeAllowed() || transactionDetails.amount <= 0 || !transactionDetails.isBuying}
                                        >
                                            Buy
                                        </button>
                                        <button
                                            className="sell-button"
                                            onClick={() => handlePlaceOrder(artwork.id, transactionDetails.amount, artwork.currentPrice, false)}
                                            disabled={!user || !isConnected || !isTradeAllowed() || transactionDetails.amount <= 0 || transactionDetails.isBuying || !(artTokenBalances[artwork.id] > 0)}
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