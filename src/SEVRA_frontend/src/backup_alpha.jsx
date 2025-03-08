import React, { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { Buffer } from "buffer";
import CountUp from 'react-countup';
import backend from './backend';
import CountUp from 'react-countup';
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

window.Buffer = Buffer;

const videoMap = {
  'UTD': 'Videos/UTD.mp4',
  'ORY': 'Videos/ORY.mp4',
  'BDO': 'Videos/BDO.mp4',
  'POL': 'Videos/POL.mp4',
  'LFA': 'Videos/LFA.mp4'
};

const projectId = '91998171939137f7f0fdc439ed1effac';
const chains = [mainnet, sepolia];
const { publicClient } = configureChains(chains, [w3mProvider({ projectId })]);
const wagmiConfig = createConfig({
  autoConnect: false,
  connectors: w3mConnectors({ projectId, chains }),
  publicClient
});
const ethereumClient = new EthereumClient(wagmiConfig, chains);

export default function App() {
  const [user, setUser] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (window.ethereum) {
      console.log("Existing Ethereum provider detected:", window.ethereum);
      window.ethereum.on('connect', () => console.log('Wallet connected'));
      window.ethereum.on('disconnect', () => console.log('Wallet disconnected'));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        localStorage.setItem('firebaseUser', JSON.stringify(firebaseUser));
        try {
          const initResult = await backend.initializeUser(firebaseUser.uid);
          setRefreshTrigger(prev => prev + 1);
        } catch (error) {
          console.error("Failed to initialize user:", error);
        }
      } else {
        const storedUser = localStorage.getItem('firebaseUser');
        if (storedUser) setUser(JSON.parse(storedUser));
      }
    });

    const particlesScript = document.createElement('script');
    particlesScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/particles.js/2.0.0/particles.min.js';
    particlesScript.async = true;
    document.body.appendChild(particlesScript);

    return () => {
      unsubscribe();
      document.body.removeChild(particlesScript);
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      localStorage.setItem("firebaseUser", JSON.stringify(result.user));
      const initResult = await backend.initializeUser(result.user.uid);
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

  const formatNumber = (num, isMarketContent = false) => {
    if (num === undefined || num === null) return "0.0";
    if (num === 0) return "0.0";
  
    let formatted = num;
    if (isMarketContent && num < 1 && num > 0) {
      formatted = Number(num.toFixed(4)); // 4 digit kalau < 1
    } else {
      formatted = Math.round(num * 10) / 10; // 1 digit default
    }
  
    const strNum = formatted.toString();
    if (strNum.includes('.')) {
      const decimalPart = strNum.split('.')[1];
      if (decimalPart && parseInt(decimalPart) !== 0) {
        return Number(formatted.toFixed(decimalPart.length + 1)).toString(); // Tambah 1 digit kalau ada desimal non-0
      }
    }
    return formatted.toFixed(1);
  };

  const fetchStagedOrders = async () => {
    if (!user) return;
    try {
        const stagedOrdersData = {};
        for (const artwork of artworks) {
            const stagedOrder = await backend.getStagedOrders(user.uid, artwork.id);
            if (stagedOrder && typeof stagedOrder === 'object' && 'nextStageTime' in stagedOrder) {
                stagedOrdersData[artwork.id] = stagedOrder;
            } else {
                stagedOrdersData[artwork.id] = null;
            }
        }
        setStagedOrders(stagedOrdersData);
    
        // Update order book dengan staged orders
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
                    filledAmount: Number(order.filledAmount || 0)
                };
                if (order.orderType?.Buy) processedOrderBook.buyOrders.push(normalizedOrder);
                else if (order.orderType?.Sell) processedOrderBook.sellOrders.push(normalizedOrder);
            });
        }
        // Tambahkan staged orders ke order book
        Object.values(stagedOrdersData).forEach(staged => {
            if (staged && staged.artworkId === activeArtworkId && staged.remainingAmount > 0) {
                const stagedOrder = {
                    id: `${staged.user || ''}-${staged.artworkId || ''}-${staged.stage || 0}`,
                    user: staged.user || '',
                    artworkId: staged.artworkId || '',
                    amount: Number(staged.stageAmount || 0),
                    price: Number(staged.price || 0),
                    timestamp: Number(staged.nextStageTime || 0),
                    status: 'Open',
                    filledAmount: 0
                };
                if (staged.orderType?.Buy) processedOrderBook.buyOrders.push(stagedOrder);
                else if (staged.orderType?.Sell) processedOrderBook.sellOrders.push(stagedOrder);
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

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchData();
      if (isConnected && activeContainer !== 'container2') setActiveContainer('container2');
    } else if (activeContainer !== 'container1') {
      setActiveContainer('container1');
    }
  }, [user, isConnected, address, refreshTrigger]);

  const fetchTradingWindow = async () => {
    try {
      let windowStatus = await backend.getTradingWindowStatus();
      windowStatus = normalizeData(windowStatus);
      setTradingWindow({
        isOpen: windowStatus.isOpen || false,
        currentWindow: Array.isArray(windowStatus.currentWindow) && windowStatus.currentWindow.length === 2 ? windowStatus.currentWindow : null,
        nextWindow: Array.isArray(windowStatus.nextWindow) && windowStatus.nextWindow.length >= 1 ? windowStatus.nextWindow : null
      });
    } catch (error) {
      console.error("Error fetching trading window:", error);
      setTradingWindow({ isOpen: false, currentWindow: null, nextWindow: null });
    }
  };

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
        if (
          stagedOrder &&
          stagedOrder.artworkId === activeArtworkId &&
          stagedOrder.remainingAmount > 0
        ) {
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
          if (stagedOrder.orderType?.Buy) {
            processedOrderBook.buyOrders.push(stagedOrderEntry);
          } else if (stagedOrder.orderType?.Sell) {
            processedOrderBook.sellOrders.push(stagedOrderEntry);
          }
        }
      }
      setOrderBook(processedOrderBook);
  
      const tokenomicsData = {};
      const animatedValuesData = {};
      for (const artwork of result) {
        let tokenomicsResult = await backend.getTokenomics(artwork.id);
        tokenomicsResult = normalizeData(tokenomicsResult) || {};
        const totalSupply = Number(artwork.totalSupply || 0);
        const circulatingSupply = totalSupply / 2; // Circulating Supply = 1/2 Total Supply
        const marketCap = circulatingSupply * Number(artwork.currentPrice || 0); // Market Cap = Circulating Supply × Current Price
  
        tokenomicsData[artwork.id] = {
          ...tokenomicsResult,
          circulatingSupply: circulatingSupply, // Set Circulating Supply
          marketCap: marketCap, // Set Market Cap
          allocation: {
            whale: Number(tokenomicsResult.whale || 0),
            medium: Number(tokenomicsResult.medium || 0),
            retail: Number(tokenomicsResult.retail || 0),
            burned: Number(tokenomicsResult.burned || 0),
            developer: Number(tokenomicsResult.developer || 0),
          },
        };
  
        animatedValuesData[artwork.id] = {
          currentPrice: Number(artwork.currentPrice || 0),
          previousPrice: Number(artwork.lastPrice || 0), // Awalnya sama dengan lastPrice biar price change 0%
          marketCap: marketCap,
          previousMarketCap: marketCap, // Awalnya sama, biar ga ada perubahan
          totalSupply: totalSupply,
          sevRatio: 20, // 1 SEV_UTD = 20 SEV (sesuai skenario)
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

  useEffect(() => {
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
              line_linked: { enable: true, distance: 150, color: "#00ffff", opacity: 0.4, width: 1 },
              move: { enable: true, speed: 2, direction: "none", random: false, straight: false, out_mode: "out", bounce: false }
            },
            interactivity: {
              detect_on: "canvas",
              events: { onhover: { enable: true, mode: "repulse" }, onclick: { enable: true, mode: "push" } },
              modes: { repulse: { distance: 100, duration: 0.4 }, push: { particles_nb: 4 } }
            }
          });
        }
      };
      if (window.particlesJS) initParticles();
      else {
        const checkParticles = setInterval(() => {
          if (window.particlesJS) {
            clearInterval(checkParticles);
            initParticles();
          }
        }, 100);
      }
    }

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

  useEffect(() => {
    const follower = document.getElementById('mouse-follower');
    const moveFollower = (e) => {
      follower.style.left = `${e.clientX}px`;
      follower.style.top = `${e.clientY}px`;
      follower.style.opacity = '1';
    };
    window.addEventListener('mousemove', moveFollower);
    return () => window.removeEventListener('mousemove', moveFollower);
  }, []);

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
    if (!user) return addNotification("Harap login terlebih dahulu");
    if (!isTradeAllowed()) return addNotification(`Trading ditutup. Jendela berikutnya: ${tradingWindow?.nextWindow ? formatWindowTime(tradingWindow.nextWindow) : "N/A"}`);
    if (amount < 1) return addNotification("Minimal transaksi adalah 1 SEV");

    try {
        const sevRatio = animatedValues[artworkId]?.sevRatio || 20;
        const marketContentAmount = amount / sevRatio;

        if (marketContentAmount < 0.05) {
            return addNotification("Minimal transaksi di market content adalah setara 0.05 SEV market content");
        }

        const orderType = isBuying ? { Buy: null } : { Sell: null };
        const result = await backend.placeOrder(user.uid, artworkId, orderType, marketContentAmount, price);
        if (result?.ok) {
            addNotification(`${isBuying ? "Beli" : "Jual"} order berhasil ditempatkan!`);
            await fetchData();
            await fetchStagedOrders();
            setRefreshTrigger(prev => prev + 1);

            // Tambahkan efek line down
            const marketContent = document.querySelector(`.market-content[data-artwork="${artworkId}"] .market-stats-container`);
            if (marketContent) {
                const lineEffect = document.createElement("div");
                lineEffect.className = `line-effect ${isBuying ? "buy-active" : "sell-active"}`;
                marketContent.appendChild(lineEffect);
                setTimeout(() => lineEffect.remove(), 2000);
            }

            const stagedOrder = await backend.getStagedOrders(user.uid, artworkId);
            if (stagedOrder && (stagedOrder.userType === '#Whale' || stagedOrder.userType === '#Medium')) {
                addNotification(`SEV_${artworkId}: Order ${isBuying ? 'beli' : 'jual'} Anda akan dibagi karena Anda adalah ${stagedOrder.userType === '#Whale' ? 'whale' : 'medium'}. Tahap berikutnya: ${new Date(stagedOrder.nextStageTime / 1000000).toLocaleString()}`);
            }
        } else {
            addNotification(`Error: ${result?.err || "Kesalahan tidak diketahui"}`);
        }
    } catch (error) {
        addNotification(`Error menempatkan order: ${error.message || "Kesalahan tidak diketahui"}`);
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

  const addNotification = (message) => {
    setNotifications(prev => [...prev, { id: Date.now(), message, type: 'popup' }]);
    setPopupMessage(message);
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 5000); // Auto-close after 5 seconds
};

  const NotificationPopup = ({ message, onClose }) => (
      <div className="popup-overlay">
          <div className="popup-content">
              <p>{message}</p>
              <button className="liquid-button" onClick={onClose}>Close</button>
          </div>
      </div>
  );

  const handleTopUp = async (amount) => {
    if (!user) return alert("Please login first!");
    const parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) return alert("Please enter a valid amount!");
    try {
      const result = await backend.topUpUSDT(user.uid, parsedAmount);
      if (result?.ok) {
        alert("Top up successful!");
        setUsdtAmount("");
        setTimeout(async () => {
          await fetchUserData();
          setRefreshTrigger(prev => prev + 1);
        }, 500);
      } else {
        alert(`Top up failed: ${result?.err || "Unknown error"}`);
      }
    } catch (error) {
      alert(`Top up failed: ${error.message || "Unknown error"}`);
    }
  };

  const handleConvert = async () => {
    if (!user) return alert("Please login first");
    const parsedAmount = parseFloat(usdtAmount) || 0;
    if (parsedAmount <= 0) return alert("Please enter a valid amount");
    try {
      const result = await backend.convertUSDTtoSEV(user.uid, parsedAmount);
      if (result?.ok) {
        alert("Conversion successful!");
        setUsdtAmount("");
        setTimeout(async () => {
          await fetchUserData();
          setRefreshTrigger(prev => prev + 1);
        }, 500);
      } else {
        alert(`Error: ${result?.err || "Unknown error"}`);
      }
    } catch (error) {
      alert(`Error: ${error.message || "Unknown error"}`);
    }
  };

  const handleTransactionChange = (e) => {
    const { name, value } = e.target;
    const newValue = parseFloat(value) || 0;
    const artwork = artworks.find(art => art.id === transactionDetails.artworkId);
    const scaleFactor = 1000000;
    const maxBuy = (balance.sevBalance / (artwork?.currentPrice || 1)) * scaleFactor || 1;
    const maxSell = (artTokenBalances[transactionDetails.artworkId] || 0) * scaleFactor || 0;
    if (name === 'amount') {
      const clampedValue = Math.max(-maxSell, Math.min(maxBuy, newValue));
      setTransactionDetails(prev => ({
        ...prev,
        amount: Math.abs(clampedValue) / scaleFactor,
        isBuying: clampedValue >= 0
      }));
    }
  };

  useEffect(() => {
    const fluctuatePrices = () => {
      setAnimatedValues(prev => {
        const newValues = { ...prev };
        artworks.forEach(artwork => {
          const currentPrice = newValues[artwork.id]?.currentPrice || artwork.currentPrice || 0;
          const previousPrice = newValues[artwork.id]?.previousPrice || artwork.currentPrice || 0;
          const priceChangePercent = ((currentPrice - previousPrice) / previousPrice * 100) || 0;
          let fluctuationRange = 0.001; // 0.1% default
          if (priceChangePercent >= 15) {
            fluctuationRange = Math.random() * 0.002 + 0.001; // 0.1% - 0.3%
          }
          const fluctuation = (Math.random() * 2 - 1) * fluctuationRange; // -0.1% sampai +0.1% (atau lebih kalau >15%)
          const newPrice = currentPrice * (1 + fluctuation);
          newValues[artwork.id] = {
            ...newValues[artwork.id],
            previousPrice: currentPrice,
            currentPrice: newPrice,
            previousMarketCap: newValues[artwork.id]?.marketCap || 0,
            marketCap: (tokenomics[artwork.id]?.circulatingSupply || 0) * newPrice,
          };
        });
        return newValues;
      });
    };
  
    const interval = setInterval(fluctuatePrices, 10_000);
    return () => clearInterval(interval);
  }, [artworks, tokenomics]);

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

      {activeContainer === 'container2' && (
        <div id="container2">
          <video className="container2-bg-video" autoPlay muted loop>
          </video>
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
            {Object.entries(artTokenBalances).map(([artworkId, amount]) => (
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
            ))}
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
                    <video className="market-bg-video" autoPlay muted loop>
                      <source src={videoMap[artwork.id]} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
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
                            <span className="gain">
                              {animatedValues[artwork.id]?.currentPrice && animatedValues[artwork.id]?.previousPrice
                                ? ` (${((animatedValues[artwork.id].currentPrice - animatedValues[artwork.id].previousPrice) / animatedValues[artwork.id].previousPrice * 100).toFixed(1)}%)`
                                : ''}
                            </span>
                          </span>
                        </div>
                        <div className="stat-item">
                          <span>Price Change:</span>
                          <span className={Number(artwork.currentPrice) > Number(artwork.lastPrice) ? 'positive' : 'negative'}>
                            {Number(artwork.currentPrice) > Number(artwork.lastPrice) ? '+' : ''}
                            {((Number(artwork.currentPrice) - Number(artwork.lastPrice)) / Number(artwork.lastPrice) * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div className="stat-item">
                          <span>Total Supply:</span>
                          <span className="animated-number">{formatNumber(animatedValues[artwork.id]?.totalSupply, true)}</span>
                        </div>
                        <div className="stat-item">
                          <span>Circulating Supply:</span>
                          <span className="animated-number">{formatNumber(tokenomics[artwork.id]?.circulatingSupply, true)}</span>
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
                                {(tokenomics[artwork.id].allocation.whale > 0 ||
                                    tokenomics[artwork.id].allocation.medium > 0 ||
                                    tokenomics[artwork.id].allocation.retail > 0 ||
                                    tokenomics[artwork.id].allocation.burned > 0 ||
                                    tokenomics[artwork.id].allocation.developer > 0) ? (
                                    <PieChart
                                        className="pie-chart"
                                        data={[
                                            { title: 'Whale', value: Math.max(tokenomics[artwork.id].allocation.whale, 1), color: '#00FFFF' },
                                            { title: 'Medium', value: Math.max(tokenomics[artwork.id].allocation.medium, 1), color: '#8A2BE2' },
                                            { title: 'Retail', value: Math.max(tokenomics[artwork.id].allocation.retail, 1), color: '#00FF00' },
                                            { title: 'Burned', value: Math.max(tokenomics[artwork.id].allocation.burned, 1), color: '#FF0000' },
                                            { title: 'Developer', value: Math.max(tokenomics[artwork.id].allocation.developer, 1), color: '#FFFF00' },
                                        ].filter(item => item.value > 0)}
                                        style={{ height: '200px' }}
                                        lineWidth={15}
                                        onMouseOver={(event, dataEntry) => {
                                            const totalSupply = Object.values(tokenomics[artwork.id].allocation).reduce((sum, val) => sum + val, 0);
                                            handlePieHover(event, dataEntry, totalSupply);
                                        }}
                                        onMouseOut={() => handlePieHover(null, null, 0)}
                                    />
                                ) : (
                                    <span>No distribution data available</span>
                                )}
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
                                {orderBook.buyOrders.slice(0, 2).map((order, index) => ( // Tampilkan hanya 2 order pertama
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
                          {formatNumber((transactionDetails.artworkId === artwork.id ? transactionDetails.amount : 0) * artwork.currentPrice)} SEV
                        </span>
                        <div className="trading-buttons">
                        <button
                          className="buy-button"
                          onClick={() => handlePlaceOrder(artwork.id, transactionDetails.amount, artwork.currentPrice, true)}
                          disabled={!user || !isConnected || !isTradeAllowed() || transactionDetails.amount <= 0 || balance.sevBalance < (transactionDetails.amount * artwork.currentPrice)}
                        >
                          Buy
                        </button>
                        <button
                          className="sell-button"
                          onClick={() => handlePlaceOrder(artwork.id, transactionDetails.amount, artwork.currentPrice, false)}
                          disabled={!user || !isConnected || !isTradeAllowed() || transactionDetails.amount <= 0 || !(artTokenBalances[artwork.id] >= transactionDetails.amount)}
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

import { useWeb3Modal } from '@web3modal/react';
import { useAccount } from 'wagmi';