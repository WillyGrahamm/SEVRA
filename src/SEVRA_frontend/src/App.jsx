import React, { useState, useEffect, useRef } from 'react';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { Buffer } from "buffer";
import CountUp from 'react-countup';
import backend from './backend';
import {
  EthereumClient,
  w3mConnectors,
  w3mProvider,
} from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/react';
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { PieChart } from 'react-minimal-pie-chart';
import './styles3.css';
import { useWeb3Modal } from '@web3modal/react';
import { useAccount } from 'wagmi';

window.Buffer = Buffer;

const videoMap = {
  'UTD': 'Videos/UTD.mp4',
  'ORY': 'Videos/ORY.mp4',
  'BDO': 'Videos/BDO.mp4',
  'POL': 'Videos/POL.mp4',
  'LFA': 'Videos/LFA.mp4',
};

const projectId = '91998171939137f7f0fdc439ed1effac';
const chains = [mainnet, sepolia];
const { publicClient } = configureChains(chains, [w3mProvider({ projectId })]);
const wagmiConfig = createConfig({
  autoConnect: false, // Pastikan autoConnect dimatikan untuk menghindari konflik
  connectors: w3mConnectors({ projectId, chains }),
  publicClient,
});
const ethereumClient = new EthereumClient(wagmiConfig, chains);

export default function App() {
  const [user, setUser] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Periksa apakah window.ethereum sudah ada dengan aman
    if (typeof window !== 'undefined' && window.ethereum) {
      console.log("Ethereum provider detected:", window.ethereum);
      
      // Tambahkan event listener tanpa mencoba mendefinisikan ulang window.ethereum
      const handleConnect = () => console.log('Wallet connected');
      const handleDisconnect = () => {
        console.log('Wallet disconnected');
        setUser(null);
        localStorage.removeItem('firebaseUser');
        setRefreshTrigger(prev => prev + 1);
      };
  
      window.ethereum.on('connect', handleConnect);
      window.ethereum.on('disconnect', handleDisconnect);
  
      // Bersihkan listener saat komponen unmount
      return () => {
        window.ethereum.removeListener('connect', handleConnect);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      };
    } else {
      console.log("No Ethereum provider detected.");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        localStorage.setItem('firebaseUser', JSON.stringify(firebaseUser));
        try {
          await backend.initializeUser(firebaseUser.uid);
          setRefreshTrigger(prev => prev + 1);
        } catch (error) {
          console.error("Failed to initialize user:", error);
        }
      } else {
        const storedUser = localStorage.getItem('firebaseUser');
        if (storedUser) setUser(JSON.parse(storedUser));
        else {
          setUser(null);
          localStorage.removeItem('firebaseUser');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      localStorage.setItem('firebaseUser', JSON.stringify(result.user));
      await backend.initializeUser(result.user.uid);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  return (
    <>
      <WagmiConfig config={wagmiConfig}>
        <SevraApp
          user={user}
          signInWithGoogle={signInWithGoogle}
          refreshTrigger={refreshTrigger}
          setRefreshTrigger={setRefreshTrigger}
        />
      </WagmiConfig>
      <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
    </>
  );
}

function SevraApp({ user, signInWithGoogle, refreshTrigger, setRefreshTrigger }) {
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const [artworks, setArtworks] = useState([]);
  const [balance, setBalance] = useState({ sevBalance: 0, usdtBalance: 0 });
  const [artTokenBalances, setArtTokenBalances] = useState({});
  const [orderBook, setOrderBook] = useState({ buyOrders: [], sellOrders: [] });
  const [tokenomics, setTokenomics] = useState({});
  const [usdtAmount, setUsdtAmount] = useState("");
  const [stagedOrders, setStagedOrders] = useState({});
  const [tradingWindow, setTradingWindow] = useState({ isOpen: false, currentWindow: null, nextWindow: null });
  const [transactionDetails, setTransactionDetails] = useState({ artworkId: '', amount: 1, price: 0, isBuying: true });
  const [activeContainer, setActiveContainer] = useState('container1');
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [animatedValues, setAnimatedValues] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [tooltipData, setTooltipData] = useState({ visible: false, title: '', percentage: 0, x: 0, y: 0 });
  const [lastInteraction, setLastInteraction] = useState(Date.now());
  const videoRef = useRef(null);

  // Efek untuk mouse follower
  useEffect(() => {
    const follower = document.getElementById('mouse-follower');
    const moveFollower = (e) => {
      follower.style.left = `${e.clientX}px`;
      follower.style.top = `${e.clientY}px`;
      follower.style.opacity = '1';
    };
    document.addEventListener('mousemove', moveFollower);
    return () => document.removeEventListener('mousemove', moveFollower);
  }, []);

  // Efek untuk video autoplay
  useEffect(() => {
    const handleVideoPlay = () => {
      if (videoRef.current) {
        videoRef.current.play().catch(error => console.error("Autoplay failed:", error));
      }
    };
    handleVideoPlay();
    const interval = setInterval(handleVideoPlay, 1000);
    return () => clearInterval(interval);
  }, [activeContainer]);

  // Efek untuk background video container1
  useEffect(() => {
    const video = document.querySelector('.container1-bg-video');
    if (video) {
      video.play().catch(error => console.error("Autoplay failed:", error));
    }
  }, []);

  // Fungsi untuk memformat angka
  const formatNumber = (num, isMarketContent = false) => {
    if (num === undefined || num === null || isNaN(num)) return "0.0";
    if (num === 0) return "0.0";
    let formatted = num;
    if (isMarketContent && Math.abs(num) < 1 && num !== 0) {
      formatted = Number(num.toFixed(4));
    } else {
      formatted = Math.round(num * 10) / 10;
    }
    const strNum = formatted.toString();
    if (strNum.includes('.')) {
      const decimalPart = strNum.split('.')[1];
      if (decimalPart && parseInt(decimalPart) !== 0) {
        return Number(formatted.toFixed(decimalPart.length + 1)).toString();
      }
    }
    return formatted.toFixed(1);
  };

  // Fungsi untuk fetch staged orders
  const fetchStagedOrders = async () => {
    if (!user) return;
    try {
      const stagedOrdersData = {};
      for (const artwork of artworks) {
        const stagedOrder = await backend.getStagedOrders(user.uid, artwork.id);
        stagedOrdersData[artwork.id] = stagedOrder && 'nextStageTime' in stagedOrder ? stagedOrder : null;
      }
      setStagedOrders(stagedOrdersData);

      const activeArtworkId = transactionDetails.artworkId || artworks[0]?.id || "UTD";
      let orderBookData = await backend.getOrderBook(activeArtworkId);
      orderBookData = normalizeData(orderBookData) || [];
      const processedOrderBook = { buyOrders: [], sellOrders: [] };
      if (Array.isArray(orderBookData)) {
        orderBookData.forEach(order => {
          const normalizedOrder = {
            id: order.id || '',
            user: order.user || '',
            artworkId: order.artworkId || '',
            amount: Number(order.amount || 0),
            price: Number(order.price || 0),
            timestamp: Number(order.timestamp || 0),
            status: order.status || 'Open',
            filledAmount: Number(order.filledAmount || 0),
          };
          if (order.orderType?.Buy) processedOrderBook.buyOrders.push(normalizedOrder);
          else if (order.orderType?.Sell) processedOrderBook.sellOrders.push(normalizedOrder);
        });
      }
      Object.values(stagedOrdersData).forEach(staged => {
        if (staged && staged.artworkId === activeArtworkId && staged.remainingAmount > 0) {
          const stagedOrderEntry = {
            id: `${staged.user || ''}-${staged.artworkId || ''}-${staged.stage || 0}`,
            user: staged.user || '',
            artworkId: staged.artworkId || '',
            amount: Number(staged.stageAmount || 0),
            price: Number(staged.price || 0),
            timestamp: Number(staged.nextStageTime || 0),
            status: 'Open',
            filledAmount: 0,
          };
          if (staged.orderType?.Buy) processedOrderBook.buyOrders.push(stagedOrderEntry);
          else if (staged.orderType?.Sell) processedOrderBook.sellOrders.push(stagedOrderEntry);
        }
      });
      setOrderBook(processedOrderBook);
    } catch (error) {
      console.error("Error fetching staged orders:", error);
      setStagedOrders({});
      setOrderBook({ buyOrders: [], sellOrders: [] });
    }
  };

  useEffect(() => {
    fetchStagedOrders();
    const interval = setInterval(fetchStagedOrders, 60_000);
    return () => clearInterval(interval);
  }, [artworks, user]);

  // Fungsi untuk normalisasi data
  const normalizeData = (data) => {
    if (data === null || data === undefined) return { sevBalance: 0, usdtBalance: 0, artTokens: [] };
    if (Array.isArray(data)) {
      if (data.length === 0) return [];
      if (data.length === 1 && typeof data[0] === 'object') return normalizeData(data[0]);
      return data.map(item => normalizeData(item));
    }
    if (typeof data === 'object' && !(data instanceof Date)) {
      const normalized = {};
      for (const key in data) {
        if (key === 'artTokens' && data[key]) {
          normalized[key] = Array.isArray(data[key]) ? data[key].map(([id, amount]) => [id, amount !== undefined ? Number(amount) : 0]) : [];
        } else if (typeof data[key] === 'bigint') {
          normalized[key] = Number(data[key]);
        } else {
          normalized[key] = normalizeData(data[key]);
        }
      }
      return normalized;
    }
    return data;
  };

  // Fungsi untuk fetch user data
  const fetchUserData = async () => {
    if (!user) return;
    try {
      let userData = await backend.getUserBalance(user.uid);
      userData = normalizeData(userData) || { usdtBalance: 0, sevBalance: 0, artTokens: [], orders: [] };
      const normalizedData = userData;
      const userObject = Array.isArray(normalizedData) ? normalizedData[0] : normalizedData;
      const newBalance = {
        sevBalance: userObject.sevBalance !== undefined ? Number(userObject.sevBalance) : 0,
        usdtBalance: userObject.usdtBalance !== undefined ? Number(userObject.usdtBalance) : 0,
      };
      setBalance(newBalance);
      const newArtTokenBalances = Array.isArray(userObject.artTokens)
        ? userObject.artTokens.reduce((acc, [id, amount]) => {
            if (amount !== undefined && amount > 0) acc[id] = Number(amount);
            return acc;
          }, {})
        : {};
      setArtTokenBalances(newArtTokenBalances);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      setBalance({ sevBalance: 0, usdtBalance: 0 });
      setArtTokenBalances({});
    }
  };

  // Fungsi untuk inisialisasi user data
  const initializeUserData = async () => {
    if (!user) return;
    try {
      await backend.initializeUser(user.uid);
      setIsInitialized(true);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Failed to initialize user:", error);
    }
  };

  useEffect(() => {
    if (user && !isInitialized) initializeUserData();
  }, [user]);

  // Fungsi untuk fetch trading window
  const fetchTradingWindow = async () => {
    try {
      let windowStatus = await backend.getTradingWindowStatus();
      windowStatus = normalizeData(windowStatus);
      setTradingWindow({
        isOpen: windowStatus.isOpen || false,
        currentWindow: Array.isArray(windowStatus.currentWindow) && windowStatus.currentWindow.length === 2 ? windowStatus.currentWindow : null,
        nextWindow: Array.isArray(windowStatus.nextWindow) && windowStatus.nextWindow.length >= 1 ? windowStatus.nextWindow : null,
      });
    } catch (error) {
      console.error("Error fetching trading window:", error);
      setTradingWindow({ isOpen: false, currentWindow: null, nextWindow: null });
    }
  };

  // Fungsi untuk fetch semua data
  const fetchData = async () => {
    if (!user) return;
    try {
      let result = await backend.getArtworks();
      result = normalizeData(result) || [];
      setArtworks(Array.isArray(result) ? result : []);

      await fetchTradingWindow();
      await fetchUserData();

      const activeArtworkId = transactionDetails.artworkId || (result[0]?.id || "UTD");
      let orderBookData = await backend.getOrderBook(activeArtworkId);
      orderBookData = normalizeData(orderBookData) || [];
      const processedOrderBook = Array.isArray(orderBookData)
        ? orderBookData.reduce(
            (acc, order) => {
              if (order.artworkId === activeArtworkId) {
                const normalizedOrder = {
                  id: order.id || '',
                  user: order.user || '',
                  artworkId: order.artworkId || '',
                  amount: Number(order.amount || 0),
                  price: Number(order.price || 0),
                  timestamp: Number(order.timestamp || 0),
                  status: order.status || 'Open',
                  filledAmount: Number(order.filledAmount || 0),
                };
                if (order.orderType?.Buy) acc.buyOrders.push(normalizedOrder);
                else if (order.orderType?.Sell) acc.sellOrders.push(normalizedOrder);
              }
              return acc;
            },
            { buyOrders: [], sellOrders: [] }
          )
        : { buyOrders: [], sellOrders: [] };

      for (const artwork of result) {
        const stagedOrder = await backend.getStagedOrders(user.uid, artwork.id);
        if (stagedOrder && stagedOrder.artworkId === activeArtworkId && stagedOrder.remainingAmount > 0) {
          const stagedOrderEntry = {
            id: `${stagedOrder.user || ''}-${stagedOrder.artworkId || ''}-${stagedOrder.stage || 0}`,
            user: stagedOrder.user || '',
            artworkId: stagedOrder.artworkId || '',
            amount: Number(stagedOrder.stageAmount || 0),
            price: Number(stagedOrder.price || 0),
            timestamp: Number(stagedOrder.nextStageTime || 0),
            status: "Open",
            filledAmount: 0,
          };
          if (stagedOrder.orderType?.Buy) processedOrderBook.buyOrders.push(stagedOrderEntry);
          else if (stagedOrder.orderType?.Sell) processedOrderBook.sellOrders.push(stagedOrderEntry);
        }
      }
      setOrderBook(processedOrderBook);

      const tokenomicsData = {};
      const animatedValuesData = {};
      for (const artwork of result) {
        let tokenomicsResult = await backend.getTokenomics(artwork.id);
        tokenomicsResult = normalizeData(tokenomicsResult) || {};
        const totalSupply = Number(artwork.totalSupply || 0);
        const circulatingSupply = Number(tokenomicsResult.circulatingSupply || totalSupply / 2);
        const marketCap = circulatingSupply * Number(artwork.currentPrice || 0);

        tokenomicsData[artwork.id] = {
          ...tokenomicsResult,
          circulatingSupply: circulatingSupply,
          marketCap: marketCap,
          allocation: {
            whale: Number(tokenomicsResult.whale || 0),
            medium: Number(tokenomicsResult.medium || 0),
            retail: Number(tokenomicsResult.retail || 0),
            burned: Number(tokenomicsResult.burned || 0),
            developer: Number(tokenomicsResult.developer || 0),
          },
        };

        const lastPriceChange = tokenomicsResult.priceChangeHistory && tokenomicsResult.priceChangeHistory.length > 0
          ? tokenomicsResult.priceChangeHistory[tokenomicsResult.priceChangeHistory.length - 1]
          : 0;

        animatedValuesData[artwork.id] = {
          currentPrice: Number(artwork.currentPrice || 0),
          previousPrice: Number(artwork.lastPrice || 0),
          marketCap: marketCap,
          previousMarketCap: marketCap,
          totalSupply: totalSupply,
          sevRatio: 20,
          priceChange: lastPriceChange,
        };
      }
      setTokenomics(tokenomicsData);
      setAnimatedValues(animatedValuesData);
    } catch (error) {
      console.error("Error fetching data:", error);
      setArtworks([]);
      setOrderBook({ buyOrders: [], sellOrders: [] });
      setTokenomics({});
      setAnimatedValues({});
    }
  };

  // Efek untuk fetch data saat user atau wallet berubah
  useEffect(() => {
    if (user) {
      fetchData();
      if (isConnected && activeContainer !== 'container2') setActiveContainer('container2');
    } else if (activeContainer !== 'container1') {
      setActiveContainer('container1');
    }
  }, [user, isConnected, address, refreshTrigger]);

  // Efek untuk update jam
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours() % 12;
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const hourHand = document.querySelector('.hour-hand');
      const minuteHand = document.querySelector('.minute-hand');
      const secondHand = document.querySelector('.second-hand');
      if (hourHand && minuteHand && secondHand) {
        hourHand.style.transform = `rotate(${(hours * 30) + (minutes * 0.5)}deg)`;
        minuteHand.style.transform = `rotate(${(minutes * 6) + (seconds * 0.1)}deg)`;
        secondHand.style.transform = `rotate(${seconds * 6}deg)`;
      }
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);
    return () => clearInterval(clockInterval);
  }, [activeContainer]);

  // Efek untuk cek idle
  useEffect(() => {
    const checkIdle = () => {
      const now = Date.now();
      if (now - lastInteraction >= 5 * 60 * 1000) {
        if (activeContainer !== 'container1') {
          setActiveContainer('container1');
          if (isConnected) {
            open();
            setTimeout(() => {
              if (!isConnected) {
                setUser(null);
                localStorage.removeItem('firebaseUser');
                setRefreshTrigger(prev => prev + 1);
              }
            }, 5000);
          }
        }
      }
    };
    const idleInterval = setInterval(checkIdle, 60 * 1000);
    return () => clearInterval(idleInterval);
  }, [activeContainer, isConnected, lastInteraction]);

  // Efek untuk handle before unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (activeContainer !== 'container1') {
        e.preventDefault();
        e.returnValue = '';
        setActiveContainer('container1');
        if (isConnected) {
          open();
          setUser(null);
          localStorage.removeItem('firebaseUser');
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeContainer, isConnected]);

  // Efek untuk inisialisasi transactionDetails
  useEffect(() => {
    if (selectedMarket && artworks.length > 0) {
      const artwork = artworks.find(art => art.id === selectedMarket);
      if (artwork) {
        const sevRatio = animatedValues[artwork.id]?.sevRatio || 20;
        const totalSupply = artwork.totalSupply || 1; // Pastikan tidak membagi dengan 0
        const priceInSev = artwork.currentPrice || 0; // Total valuasi dalam SEV
        const pricePerSevToken = priceInSev / totalSupply; // Harga per SEV_TOKEN dalam SEV
        const maxBuyInSev = balance.sevBalance / pricePerSevToken; // Jumlah SEV_TOKEN yang bisa dibeli
        const maxSell = artTokenBalances[artwork.id] || 0; // Sudah dalam SEV_TOKEN
        
        console.log("Slider sync:", { 
          artworkId: artwork.id, 
          maxBuy: maxBuyInSev, 
          maxSell, 
          sevBalance: balance.sevBalance, 
          priceInSev, 
          pricePerSevToken, 
          sevRatio, 
          totalSupply 
        });
  
        setTransactionDetails(prev => ({
          ...prev,
          artworkId: artwork.id,
          price: pricePerSevToken, // Simpan harga per SEV_TOKEN dalam SEV
          amount: Math.min(1, maxSell > 0 ? maxSell : maxBuyInSev), // Default ke 1 atau max yang tersedia
          isBuying: maxSell === 0, // Jika tidak ada token untuk dijual, default ke beli
        }));
      }
    }
  }, [selectedMarket, artworks, balance, artTokenBalances, animatedValues]);

  // Efek untuk sinkronkan transactionDetails dengan selectedMarket
  useEffect(() => {
    if (selectedMarket && artworks.length > 0) {
      const artwork = artworks.find(art => art.id === selectedMarket);
      if (artwork) {
        const sevRatio = animatedValues[artwork.id]?.sevRatio || 20;
        const maxSellInSevToken = artTokenBalances[artwork.id] || 0; // Already in SEV_TOKEN
        const maxBuyInSev = balance.sevBalance / (artwork.currentPrice || 1);
        const maxBuy = maxBuyInSev / sevRatio; // Convert to SEV_TOKEN
        setTransactionDetails(prev => ({
          ...prev,
          artworkId: artwork.id,
          price: artwork.currentPrice,
          amount: maxSellInSevToken > 0 ? 0 : Math.min(1, maxBuy),
          isBuying: maxSellInSevToken === 0,
        }));
      }
    }
  }, [selectedMarket, artworks, balance, artTokenBalances]);

  // Efek untuk fluktuasi harga
  useEffect(() => {
    const fluctuatePrices = () => {
      setAnimatedValues(prev => {
        const newValues = { ...prev };
        artworks.forEach(artwork => {
          const currentPrice = newValues[artwork.id]?.currentPrice || artwork.currentPrice || 0;
          const previousPrice = newValues[artwork.id]?.previousPrice || artwork.currentPrice || 0;
          const priceChangePercent = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice * 100) : 0;
          let fluctuationRange = 0.005 + (Math.abs(priceChangePercent) > 10 ? 0.015 : 0); // 0.5% - 2%
          const fluctuation = (Math.random() * 2 - 1) * fluctuationRange;
          const newPrice = currentPrice * (1 + fluctuation);
          const newCirculatingSupply = (newValues[artwork.id]?.totalSupply || 0) / 2;
          const newPriceChange = previousPrice > 0 ? ((newPrice - previousPrice) / previousPrice * 100) : 0;

          newValues[artwork.id] = {
            ...newValues[artwork.id],
            previousPrice: currentPrice,
            currentPrice: newPrice,
            previousMarketCap: newValues[artwork.id]?.marketCap || 0,
            marketCap: newCirculatingSupply * newPrice,
            priceChange: newPriceChange,
          };
        });
        return newValues;
      });
    };

    const interval = setInterval(fluctuatePrices, 30_000); // Update setiap 30 detik
    return () => clearInterval(interval);
  }, [artworks]);

  // Fungsi untuk menangani order
  const handlePlaceOrder = async (artworkId, amount, price, isBuying = true) => {
    if (!user) return addNotification("Please login first");
    if (!isTradeAllowed()) return addNotification(`Trading closed. Next window: ${tradingWindow?.nextWindow ? formatWindowTime(tradingWindow.nextWindow) : "N/A"}`);
    if (amount < 1) return addNotification("Minimum transaction is 1 SEV_TOKEN");
  
    console.log("Placing order:", { artworkId, amount, price, isBuying, sevBalance: balance.sevBalance, artTokenBalance: artTokenBalances[artworkId] });
  
    try {
      const marketContentAmount = amount; // Amount dalam SEV_TOKEN
      if (marketContentAmount < 0.05) {
        return addNotification("Minimum transaction in market content is 0.05 SEV_TOKEN");
      }
  
      const orderType = isBuying ? { Buy: null } : { Sell: null };
      const result = await backend.placeOrder(user.uid, artworkId, orderType, marketContentAmount, price); // price dalam SEV per SEV_TOKEN
      if (result?.ok) {
        addNotification(`${isBuying ? "Buy" : "Sell"} order placed successfully!`);
        await fetchData();
        await fetchStagedOrders();
        setRefreshTrigger(prev => prev + 1);
  
        const marketContent = document.querySelector(`.market-content[data-artwork="${artworkId}"] .market-stats-container`);
        if (marketContent) {
          const lineEffect = document.createElement("div");
          lineEffect.className = `line-effect ${isBuying ? "buy-active" : "sell-active"}`;
          marketContent.appendChild(lineEffect);
          setTimeout(() => lineEffect.remove(), 2000);
        }
  
        const stagedOrder = await backend.getStagedOrders(user.uid, artworkId);
        if (stagedOrder && (stagedOrder.userType === '#Whale' || stagedOrder.userType === '#Medium')) {
          addNotification(`SEV_${artworkId}: Your ${isBuying ? 'buy' : 'sell'} order will be split because you are a ${stagedOrder.userType === '#Whale' ? 'whale' : 'medium'}. Next phase: ${new Date(stagedOrder.nextStageTime / 1000000).toLocaleString()}`);
        }
      } else {
        addNotification(`Error: ${result?.err || "Unknown error"}`);
      }
    } catch (error) {
      addNotification(`Error placing order: ${error.message || "Unknown error"}`);
    }
  };

  const isTradeAllowed = () => tradingWindow?.isOpen || false;

  const formatWindowTime = (window) => {
    if (!window || !Array.isArray(window) || window.length < 2) return 'Not available';
    try {
      const offsetWIB = 7;
      const startWIB = (parseInt(window[0], 10) + offsetWIB) % 24;
      const endWIB = (parseInt(window[1], 10) + offsetWIB) % 24;
      return `${String(startWIB).padStart(2, '0')}:00 - ${String(endWIB).padStart(2, '0')}:00 WIB`;
    } catch (error) {
      console.error("Error formatting window time:", error);
      return 'Not available';
    }
  };

  const NotificationPopup = ({ message, onClose }) => {
    useEffect(() => {
      const timer = setTimeout(() => {
        const overlay = document.querySelector('.popup-overlay');
        if (overlay) {
          overlay.classList.add('closing');
          setTimeout(() => onClose(), 500);
        }
      }, 4500);
      return () => clearTimeout(timer);
    }, [onClose]);

    return (
      <div className="popup-overlay">
        <div className="popup-content">
          <p>{message}</p>
          <button className="liquid-button" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const addNotification = (message) => {
    setNotifications(prev => [...prev, { id: Date.now(), message, type: 'popup' }]);
    setPopupMessage(message);
    setShowPopup(true);
  };

  const handleTopUp = async (amount) => {
    if (!user) return addNotification("Please login first!");
    const parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) return addNotification("Please enter a valid amount!");
    try {
      const result = await backend.topUpUSDT(user.uid, parsedAmount);
      if (result?.ok) {
        addNotification("Top up successful!");
        setUsdtAmount("");
        setTimeout(async () => {
          await fetchUserData();
          setRefreshTrigger(prev => prev + 1);
        }, 500);
      } else {
        addNotification(`Top up failed: ${result?.err || "Unknown error"}`);
      }
    } catch (error) {
      addNotification(`Top up failed: ${error.message || "Unknown error"}`);
    }
  };

  const handleConvert = async () => {
    if (!user) return addNotification("Please login first");
    const parsedAmount = parseFloat(usdtAmount) || 0;
    if (parsedAmount <= 0) return addNotification("Please enter a valid amount");
    try {
      const result = await backend.convertUSDTtoSEV(user.uid, parsedAmount);
      if (result?.ok) {
        addNotification("Conversion successful!");
        setUsdtAmount("");
        setTimeout(async () => {
          await fetchUserData();
          setRefreshTrigger(prev => prev + 1);
        }, 500);
      } else {
        addNotification(`Error: ${result?.err || "Unknown error"}`);
      }
    } catch (error) {
      addNotification(`Error: ${error.message || "Unknown error"}`);
    }
  };

  const handleTransactionChange = (e) => {
    const { value } = e.target;
    const newValue = parseFloat(value) || 0;
    const artwork = artworks.find(art => art.id === transactionDetails.artworkId);
    if (!artwork) return;

    const sevRatio = animatedValues[artwork.id]?.sevRatio || 20;
    const totalSupply = artwork.totalSupply || 1;
    const priceInSev = artwork.currentPrice || 0;
    const pricePerSevToken = priceInSev / totalSupply; // Harga per SEV_TOKEN dalam SEV
    const maxBuyInSev = pricePerSevToken > 0 ? balance.sevBalance / pricePerSevToken : 0; // Jumlah SEV_TOKEN yang bisa dibeli
    const maxSell = artTokenBalances[artwork.id] || 0; // Sudah dalam SEV_TOKEN
    const maxAmount = transactionDetails.isBuying ? maxBuyInSev : maxSell;

    const clampedValue = Math.max(0, Math.min(maxAmount, newValue));
    console.log("Slider change:", { newValue, maxAmount, clampedValue, isBuying: transactionDetails.isBuying });

    setTransactionDetails(prev => ({
      ...prev,
      amount: clampedValue,
    }));
  };

  const handlePieHover = (event, dataEntry, totalSupply) => {
    if (!dataEntry) {
      setTooltipData({ visible: false, title: '', percentage: 0, x: 0, y: 0 });
      return;
    }
    const percentage = (dataEntry.value / totalSupply * 100).toFixed(1);
    setTooltipData({
      visible: true,
      title: dataEntry.title,
      percentage,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const switchContainer = (container) => setActiveContainer(container);

  const showMarketContent = (contentId) => {
    setSelectedMarket(prev => (prev === contentId ? null : contentId));
    if (contentId && contentId !== selectedMarket) {
      const artwork = artworks.find(art => art.id === contentId);
      if (artwork) {
        setTimeout(() => {
          const header = document.querySelector(`.market-content[data-artwork="${contentId}"] .market-header h3`);
          if (header) {
            header.style.animation = 'none';
            header.offsetHeight;
            header.style.animation = 'typing 2s steps(40, end), blink-caret 0.75s step-end infinite';
          }
        }, 100);
      }
    }
  };

  const connectWallet = () => open();

  return (
    <div style={{ backgroundColor: "black" }}>
      <nav className="navbar">
        <a href="https://localhost:5173/" className="logo" onClick={() => switchContainer('container1')}>
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

      {activeContainer === 'container1' && (
        <div id="container1">
          <video
            ref={videoRef}
            className="container1-bg-video"
            autoPlay
            muted
            loop
            playsInline
            onError={(e) => console.error("Video error:", e)}
          >
            <source src="/Videos/asset_web3_3.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
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
            ▼
          </div>
          <div id="mouse-follower"></div>
        </div>
      )}

      {activeContainer === 'container2' && (
        <div id="container2">
          <video className="container2-bg-video" autoPlay muted loop></video>
          <div className="dashboard-top">
            <div className="user-data">
              <h2>Your Portfolio</h2>
              <div className="data-row">
                <span>USDT:</span>
                <span>{formatNumber(balance.usdtBalance)} USDT</span>
              </div>
              <div className="data-row">
                <span>SEV:</span>
                <span>{formatNumber(balance.sevBalance)} SEV</span>
              </div>
              {Object.entries(artTokenBalances).map(([artworkId, amount]) =>
                amount !== undefined && (
                  <div className="data-row sub-token" key={artworkId}>
                    <span>{`SEV_${artworkId}`}:</span>
                    <span>
                      {formatNumber(amount)} {`SEV_${artworkId}`}
                      {stagedOrders[artworkId]?.nextStageTime && !isNaN(stagedOrders[artworkId].nextStageTime) && (
                        <span className="staged-notification">
                          (Your {formatNumber(stagedOrders[artworkId].remainingAmount)} SEV will be split because you are a {stagedOrders[artworkId].userType === '#Whale' ? 'whale' : stagedOrders[artworkId].userType === '#Medium' ? 'medium' : 'retail'}. Next phase of {stagedOrders[artworkId].orderType?.Buy ? 'buy' : 'sell'}: {new Date(stagedOrders[artworkId].nextStageTime / 1000000).toLocaleString()})
                        </span>
                      )}
                    </span>
                  </div>
                )
              )}
              <div className="data-row">
                <span>Wallet Address:</span>
                <span>{isConnected ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Not connected'}</span>
              </div>
            </div>

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
                    <span>{tradingWindow.currentWindow ? formatWindowTime(tradingWindow.currentWindow) : 'Not available'}</span>
                  </div>
                  <div className="data-row">
                    <span>Next Window:</span>
                    <span>{tradingWindow.nextWindow ? formatWindowTime(tradingWindow.nextWindow) : 'Not available'}</span>
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
                    <button onClick={() => handleTopUp(usdtAmount)} disabled={!usdtAmount || parseFloat(usdtAmount) <= 0}>
                      Top Up USDT
                    </button>
                    <button onClick={handleConvert} disabled={!usdtAmount || parseFloat(usdtAmount) <= 0}>
                      Convert to SEV
                    </button>
                  </div>
                  <div className="note">1 SEV = 20 USDT. SEV is used for trading artwork tokens.</div>
                </div>
              )}
            </div>
          </div>

          <div className="market-buttons-container">
            <h2 className="market-buttons-title">Artwork Markets</h2>
            {artworks.length > 0 ? (
              artworks.map((artwork) => (
                <div className="market-item" key={artwork.id}>
                  <button
                    className={`market-button ${selectedMarket === artwork.id ? 'expanded' : ''}`}
                    onClick={() => showMarketContent(artwork.id)}
                  >
                    {artwork.name} - {artwork.symbol}
                  </button>
                  <div className={`market-content ${selectedMarket === artwork.id ? 'active' : ''}`} data-artwork={artwork.id}>
                    <video className="market-bg-video" autoPlay muted loop onError={(e) => console.error(`Failed to load video for ${artwork.id}: ${videoMap[artwork.id]}`)}>
                      <source src={videoMap[artwork.id]} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                    <div className="market-video-overlay"></div>
                    <div className="market-content-inner">
                      <div className="market-header">
                        <h3>{artwork.name} Market</h3>
                      </div>
                      <div className="market-stats-container">
                        <div className="market-stats">
                          <div className="stat-item">
                            <span>Current Price:</span>
                            <span className={`animated-number ${animatedValues[artwork.id]?.currentPrice > animatedValues[artwork.id]?.previousPrice ? 'positive' : 'negative'}`}>
                              <CountUp
                                start={animatedValues[artwork.id]?.previousPrice || animatedValues[artwork.id]?.currentPrice || 0}
                                end={animatedValues[artwork.id]?.currentPrice || 0}
                                duration={1.5}
                                separator=","
                                suffix=" SEV"
                                decimals={1}
                                useEasing={true}
                              />
                            </span>
                          </div>
                          <div className="stat-item">
                            <span>Price Change:</span>
                            <span className={animatedValues[artwork.id]?.priceChange >= 0 ? 'positive' : 'negative'}>
                              {formatNumber(animatedValues[artwork.id]?.priceChange || 0, true)}%
                            </span>
                          </div>
                          <div className="stat-item">
                            <span>Total Supply:</span>
                            <span>{formatNumber(animatedValues[artwork.id]?.totalSupply || 0)} SEV</span>
                          </div>
                          <div className="stat-item">
                            <span>Circulating Supply:</span>
                            <span>{formatNumber(tokenomics[artwork.id]?.circulatingSupply || 0)} SEV</span>
                          </div>
                          <div className="stat-item">
                            <span>Market Cap:</span>
                            <span className={`animated-number ${animatedValues[artwork.id]?.marketCap > animatedValues[artwork.id]?.previousMarketCap ? 'positive' : 'negative'}`}>
                              <CountUp
                                start={animatedValues[artwork.id]?.previousMarketCap || animatedValues[artwork.id]?.marketCap || 0}
                                end={animatedValues[artwork.id]?.marketCap || 0}
                                duration={1.5}
                                separator=","
                                suffix=" SEV"
                                decimals={1}
                                useEasing={true}
                              />
                            </span>
                          </div>
                        </div>
                        {tokenomics[artwork.id]?.allocation && (
                          <div className="tokenomics-item">
                            <span>Tokenomics Allocation:</span>
                            <PieChart
                              className="pie-chart"
                              data={[
                                tokenomics[artwork.id].allocation.whale > 0 ? { title: 'Whale', value: tokenomics[artwork.id].allocation.whale, color: '#00FFFF' } : null,
                                tokenomics[artwork.id].allocation.medium > 0 ? { title: 'Medium', value: tokenomics[artwork.id].allocation.medium, color: '#8A2BE2' } : null,
                                tokenomics[artwork.id].allocation.retail > 0 ? { title: 'Retail', value: tokenomics[artwork.id].allocation.retail, color: '#00FF00' } : null,
                                tokenomics[artwork.id].allocation.burned > 0 ? { title: 'Burned', value: tokenomics[artwork.id].allocation.burned, color: '#FF0000' } : null,
                                tokenomics[artwork.id].allocation.developer > 0 ? { title: 'Developer', value: tokenomics[artwork.id].allocation.developer, color: '#FFFF00' } : null,
                              ].filter(item => item !== null)}
                              style={{ height: '200px' }}
                              lineWidth={15}
                              onMouseOver={(event, dataEntry) => {
                                const totalSupply = Object.values(tokenomics[artwork.id].allocation).reduce((sum, val) => sum + val, 0);
                                handlePieHover(event, dataEntry, totalSupply);
                              }}
                              onMouseOut={() => handlePieHover(null, null, 0)}
                            />
                            {tooltipData.visible && (
                              <div
                                className="tooltip"
                                style={{ left: tooltipData.x + 10, top: tooltipData.y + 10 }}
                              >
                                {tooltipData.title}: {tooltipData.percentage}%
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="order-book">
                        <div className="order-book-horizontal">
                          <div className="order-column buy-column">
                            <h4>Buy Orders</h4>
                            {orderBook.buyOrders.slice(0, 2).map((order, index) => (
                              <div key={index} className="order-bar buy-bar">
                                <div style={{ width: `${(order.amount / artwork.totalSupply) * 100 * 12}%` }}></div>
                                <span>{formatNumber(order.amount)} @ {formatNumber(order.price)} SEV</span>
                              </div>
                            ))}
                            {orderBook.buyOrders.length > 2 && (
                              <div className="order-scroll">
                                {orderBook.buyOrders.slice(2).map((order, index) => (
                                  <div key={index + 2} className="order-bar buy-bar">
                                    <div style={{ width: `${(order.amount / artwork.totalSupply) * 100 * 12}%` }}></div>
                                    <span>{formatNumber(order.amount)} @ {formatNumber(order.price)} SEV</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="order-column sell-column">
                            <h4>Sell Orders</h4>
                            {orderBook.sellOrders.slice(0, 2).map((order, index) => (
                              <div key={index} className="order-bar sell-bar">
                                <div style={{ width: `${(order.amount / artwork.totalSupply) * 100 * 12}%` }}></div>
                                <span>{formatNumber(order.amount)} @ {formatNumber(order.price)} SEV</span>
                              </div>
                            ))}
                            {orderBook.sellOrders.length > 2 && (
                              <div className="order-scroll">
                                {orderBook.sellOrders.slice(2).map((order, index) => (
                                  <div key={index + 2} className="order-bar sell-bar">
                                    <div style={{ width: `${(order.amount / artwork.totalSupply) * 100 * 12}%` }}></div>
                                    <span>{formatNumber(order.amount)} @ {formatNumber(order.price)} SEV</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="trading-controls">
                        <input
                          type="range"
                          name="amount"
                          min="0"
                          max={
                            transactionDetails.isBuying
                              ? Math.max(1, balance.sevBalance / (transactionDetails.price || 1)) // pricePerSevToken dalam SEV
                              : Math.max(1, artTokenBalances[transactionDetails.artworkId] || 0)
                          }
                          step="0.01"
                          value={transactionDetails.amount || 0}
                          onChange={handleTransactionChange}
                          className="slider"
                          disabled={!user || !isConnected || !isTradeAllowed()}
                        />
                        <span className="slider-value">
                          {transactionDetails.isBuying ? 'Buy' : 'Sell'}: {transactionDetails.amount.toFixed(2)} SEV_TOKEN =
                          {formatNumber(transactionDetails.amount * transactionDetails.price)} SEV Total
                        </span>
                        <div className="trading-buttons">
                          <button
                            className="buy-button"
                            onClick={() => {
                              console.log("Attempting to buy:", {
                                artworkId: transactionDetails.artworkId,
                                amount: transactionDetails.amount,
                                price: transactionDetails.price, // Dalam SEV per SEV_TOKEN
                                totalSev: transactionDetails.amount * transactionDetails.price,
                                sevBalance: balance.sevBalance,
                              });
                              handlePlaceOrder(transactionDetails.artworkId, transactionDetails.amount, transactionDetails.price, true);
                            }}
                            disabled={
                              !user ||
                              !isConnected ||
                              !isTradeAllowed() ||
                              transactionDetails.amount <= 0 ||
                              transactionDetails.price <= 0 ||
                              balance.sevBalance < (transactionDetails.amount * transactionDetails.price)
                            }
                          >
                            Buy ({formatNumber(transactionDetails.amount * transactionDetails.price)} SEV)
                          </button>
                          <button
                            className="sell-button"
                            onClick={() => {
                              console.log("Attempting to sell:", {
                                artworkId: transactionDetails.artworkId,
                                amount: transactionDetails.amount,
                                price: transactionDetails.price, // Dalam SEV per SEV_TOKEN
                                artTokenBalance: artTokenBalances[transactionDetails.artworkId],
                              });
                              handlePlaceOrder(transactionDetails.artworkId, transactionDetails.amount, transactionDetails.price, false);
                            }}
                            disabled={
                              !user ||
                              !isConnected ||
                              !isTradeAllowed() ||
                              transactionDetails.amount <= 0 ||
                              transactionDetails.price <= 0 ||
                              !(artTokenBalances[transactionDetails.artworkId] >= transactionDetails.amount)
                            }
                          >
                            Sell ({formatNumber(transactionDetails.amount * transactionDetails.price)} SEV)
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
      {showPopup && <NotificationPopup message={popupMessage} onClose={() => setShowPopup(false)} />}
    </div>
  );
}