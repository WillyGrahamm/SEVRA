import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Float "mo:base/Float";
import Text "mo:base/Text";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Int "mo:base/Int";
import Order "mo:base/Order";

actor class RWA() {
    // Token Configuration
    private stable var baseTokenSymbol: Text = "SEV";
    private stable var baseTokenPrice: Float = 5.0; // USDT
    
    // Market Configuration
    private stable var whaleThreshold: Float = 0.25; // 25% of total supply
    private stable var mediumThreshold: Float = 0.10; // 10% of total supply
    private stable var maxWhalePurchase: Float = 0.30; // 30% maximum whale holding
    
    // Order Types
    private type OrderType = {
        #Buy;
        #Sell;
    };

    // Order Status
    private type OrderStatus = {
        #Open;
        #Partial;
        #Filled;
        #Cancelled;
    };

    // Order Book Entry
    private type Order = {
        id: Text;
        user: Text;
        artworkId: Text;
        orderType: OrderType;
        amount: Float;
        price: Float;
        timestamp: Time.Time;
        var status: OrderStatus;
        var filledAmount: Float;
    };

    private type OrderView = {
        id: Text;
        user: Text;
        artworkId: Text;
        orderType: OrderType;
        amount: Float;
        price: Float;
        timestamp: Time.Time;
        status: OrderStatus;
        filledAmount: Float;
    };

    // Trading Windows (in hours from day start, UTC)
    private let tradingWindows: [[Nat]] = [
    [1, 3],   // Morning window: 01:00-03:00 GMT (08:00-10:00 WIB)
    [5, 7],   // Afternoon window: 05:00-07:00 GMT (12:00-14:00 WIB)
    [10, 12], // Evening window: 10:00-12:00 GMT (17:00-19:00 WIB)
    [15, 17]  // Night window: 15:00-17:00 GMT (22:00-00:00 WIB)
    ];


    // Price Appreciation Rates (in percentages)
    private type AppreciationRates = {
        hourly: Float;
        daily: Float;
        weekly: Float;
        monthly: Float;
        yearly: Float;
    };

    // Artwork Configuration
    private type Artwork = {
        id: Text;
        name: Text;
        artist: Text;
        symbol: Text;
        totalSupply: Nat;
        developerSupply: Nat;
        currentPrice: Float;
        lastPrice: Float;
        description: Text;
        lastSaleDate: Time.Time;
        appreciationRates: AppreciationRates;
        status: Text;
    };

    // Tokenomics
    private type Tokenomics = {
        var circulatingSupply: Float;
        var burnedSupply: Float;
        var marketCap: Float;
        var volume24h: Float;
        var totalValueLocked: Float;
    };

    private type TokenomicsView = {
        circulatingSupply: Float;
        burnedSupply: Float;
        marketCap: Float;
        volume24h: Float;
        totalValueLocked: Float;
    };

    // User Types
    private type UserType = {
        #Whale;
        #Medium;
        #Retail;
    };

    private type UserBalance = {
        var usdtBalance: Float;
        var sevBalance: Float;
        var artTokens: HashMap.HashMap<Text, Float>;
        var orders: Buffer.Buffer<Order>;
    };
    
    private type UserBalanceView = {
        usdtBalance: Float;
        sevBalance: Float;
        artTokens: [(Text, Float)];
        orders: [OrderView];
    };

    // State Variables
    private var userBalances = HashMap.HashMap<Text, UserBalance>(10, Text.equal, Text.hash);
    private var orderBooks = HashMap.HashMap<Text, Buffer.Buffer<Order>>(10, Text.equal, Text.hash);
    private var tokenomics = HashMap.HashMap<Text, Tokenomics>(10, Text.equal, Text.hash);
    private var lastPriceUpdate = Time.now();
    private var lastBurning = Time.now();

    private type MinimumReturn = {
    artworkId: Text;
    minReturnPercentage: Float;
    };

    // Tambahkan variable untuk minimum returns
    private let minimumReturns: [MinimumReturn] = [
        { artworkId = "UTD"; minReturnPercentage = 15.38 },
        { artworkId = "ORY"; minReturnPercentage = 16.67 },
        { artworkId = "BDO"; minReturnPercentage = 25.00 },
        { artworkId = "POL"; minReturnPercentage = 25.00 },
        { artworkId = "LFA"; minReturnPercentage = 13.64 }
    ];

    // Tambahkan variable untuk tracking periode check
    private stable var lastReturnCheckTime = Time.now();

    // Helper Functions
    private func getCurrentHour() : Nat {
        let currentTime = Time.now();
        let hoursFromEpoch = Int.abs(currentTime) / (3600 * 1000000000);
        hoursFromEpoch % 24
    };

    private func isWithinTradingWindow() : Bool {
        let currentHour = getCurrentHour();
        for (window in tradingWindows.vals()) {
            if (window[0] > window[1]) {
                // Handle windows that wrap around midnight
                if (currentHour >= window[0] or currentHour < window[1]) {
                    return true;
                };
            } else if (currentHour >= window[0] and currentHour < window[1]) {
                return true;
            };
        };
        false
    };

    // Sorting function for orders
    private func sortOrders(orders: [Order]) : [Order] {
        Array.sort<Order>(orders, func(a: Order, b: Order) : Order.Order {
            if (a.price < b.price) { #less }
            else if (a.price > b.price) { #greater }
            else { #equal }
        })
    };

    // Convert Buffer to Array helper
    private func convertBufferToArray<T>(buffer: Buffer.Buffer<T>) : [T] {
        Buffer.toArray(buffer)
    };

    private var artworks: [var Artwork] = [var 
        {
            id = "UTD";
            name = "Untitled";
            artist = "Jean-Michel Basquiat";
            symbol = "SEV_UTD";
            totalSupply = 1_000_000;
            developerSupply = 500_000;
            currentPrice = 7_500_000.0; // Divided by 20 from 150_000_000.0
            lastPrice = 6_500_000.0; // Divided by 20 from 130_000_000.0
            description = "Iconic painting known for graffiti and expressionist style";
            lastSaleDate = 1495584000000000000; // May 2017
            appreciationRates = {
                hourly = 0.001;
                daily = 0.024;
                weekly = 0.168;
                monthly = 0.72;
                yearly = 12.0;
            };
            status = "Private Collection";
        },
        {
            id = "ORY";
            name = "Orange, Red, Yellow";
            artist = "Mark Rothko";
            symbol = "SEV_ORY";
            totalSupply = 800_000;
            developerSupply = 400_000;
            currentPrice = 7_000_000.0; // Divided by 20 from 140_000_000.0
            lastPrice = 6_000_000.0; // Divided by 20 from 120_000_000.0
            description = "Abstract expressionist painting with large emotional color fields";
            lastSaleDate = 1336723200000000000; // May 2012
            appreciationRates = {
                hourly = 0.001;
                daily = 0.024;
                weekly = 0.168;
                monthly = 0.72;
                yearly = 11.0;
            };
            status = "Private Collection";
        },
        {
            id = "BDO";
            name = "Balloon Dog (Orange)";
            artist = "Jeff Koons";
            symbol = "SEV_BDO";
            totalSupply = 600_000;
            developerSupply = 300_000;
            currentPrice = 5_000_000.0; // Divided by 20 from 100_000_000.0
            lastPrice = 4_000_000.0; // Divided by 20 from 80_000_000.0
            description = "Iconic stainless steel sculpture of a balloon dog";
            lastSaleDate = 1384214400000000000; // Nov 2013
            appreciationRates = {
                hourly = 0.001;
                daily = 0.024;
                weekly = 0.168;
                monthly = 0.72;
                yearly = 13.5;
            };
            status = "Private Collection";
        },
        {
            id = "POL";
            name = "No. 5, 1948";
            artist = "Jackson Pollock";
            symbol = "SEV_POL";
            totalSupply = 500_000;
            developerSupply = 250_000;
            currentPrice = 12_500_000.0; // Divided by 20 from 250_000_000.0
            lastPrice = 10_000_000.0; // Divided by 20 from 200_000_000.0
            description = "Famous abstract expressionist action painting";
            lastSaleDate = 1162944000000000000; // Nov 2006
            appreciationRates = {
                hourly = 0.001;
                daily = 0.024;
                weekly = 0.168;
                monthly = 0.72;
                yearly = 9.0;
            };
            status = "Private Collection";
        },
        {
            id = "LFA";
            name = "Les Femmes d'Alger (Version O)";
            artist = "Pablo Picasso";
            symbol = "SEV_LFA";
            totalSupply = 400_000;
            developerSupply = 200_000;
            currentPrice = 12_500_000.0; // Divided by 20 from 250_000_000.0
            lastPrice = 11_000_000.0; // Divided by 20 from 220_000_000.0
            description = "Part of Picasso's series inspired by Orientalist art";
            lastSaleDate = 1431475200000000000; // May 2015
            appreciationRates = {
                hourly = 0.001;
                daily = 0.024;
                weekly = 0.168;
                monthly = 0.72;
                yearly = 8.0;
            };
            status = "Private Collection";
        }
    ]


    // Initialize order books and tokenomics for each artwork
    private func initializeArtwork() {
        for (artwork in artworks.vals()) {
            let orders = Buffer.Buffer<Order>(100);
            orderBooks.put(artwork.id, orders);

            let initialTokenomics : Tokenomics = {
                var circulatingSupply = Float.fromInt(artwork.totalSupply - artwork.developerSupply);
                var burnedSupply = 0.0;
                var marketCap = Float.fromInt(artwork.totalSupply) * artwork.currentPrice;
                var volume24h = 0.0;
                var totalValueLocked = Float.fromInt(artwork.developerSupply) * artwork.currentPrice;
            };
            tokenomics.put(artwork.id, initialTokenomics);
        };
    };

    // Initialize system
    initializeArtwork();

    private func getUserType(amount: Float, artworkId: Text) : UserType {
        let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a: Artwork) : Bool { a.id == artworkId });
        switch (artwork) {
            case (?art) {
                let percentage = amount / Float.fromInt(art.totalSupply);
                if (percentage > whaleThreshold) { #Whale }
                else if (percentage > mediumThreshold) { #Medium }
                else { #Retail }
            };
            case null { #Retail }
        }
    };

    // Price Update Functions
    private func updatePrices() {
        let currentTime = Time.now();
        let hoursPassed = Float.fromInt(Int.abs(currentTime - lastPriceUpdate)) / (3600.0 * 1000000000.0);
        
        for (i in Iter.range(0, artworks.size() - 1)) {
            let artwork = artworks[i];
            let appreciationRate = artwork.appreciationRates.hourly * hoursPassed;
            artworks[i] := {
                artwork with
                lastPrice = artwork.currentPrice;
                currentPrice = artwork.currentPrice * (1.0 + appreciationRate);
            };
        };
        
        lastPriceUpdate := currentTime;
        
        // Tambahkan check minimum return dan auto burn
        checkMinimumReturnAndBurn();
    };

    private func burnTokens(artworkId: Text, amount: Float) {
        switch (tokenomics.get(artworkId)) {
            case (?stats) {
                stats.burnedSupply += amount;
                stats.circulatingSupply -= amount;
                
                // First find the artwork
                let foundArtwork = Array.find<Artwork>(Array.freeze(artworks), func(a: Artwork) : Bool { 
                    a.id == artworkId 
                });
                
                // Then calculate the market cap
                let price = switch (foundArtwork) {
                    case (?art) { art.currentPrice };
                    case null { 0.0 };
                };
                
                stats.marketCap := stats.circulatingSupply * price;
            };
            case null {};
        };
    };  

    // Fungsi untuk mengecek minimum return dan melakukan auto burn
    private func checkMinimumReturnAndBurn() {
        let currentTime = Time.now();
        // Check setiap minggu (7 hari)
        if (Float.fromInt(Int.abs(currentTime - lastReturnCheckTime)) >= (7.0 * 24.0 * 3600.0 * 1000000000.0)) {
            
            for (minReturn in minimumReturns.vals()) {
                let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a: Artwork) : Bool { 
                    a.id == minReturn.artworkId 
                });
                
                switch (artwork) {
                    case (?art) {
                        // Hitung actual return (annualized)
                        let timeSinceLastPrice = Float.fromInt(Int.abs(currentTime - lastPriceUpdate)) / (365.0 * 24.0 * 3600.0 * 1000000000.0); // dalam tahun
                        let actualReturn = ((art.currentPrice - art.lastPrice) / art.lastPrice) * (1.0 / timeSinceLastPrice) * 100.0;
                        
                        // Jika return lebih rendah dari minimum
                        if (actualReturn < minReturn.minReturnPercentage) {
                            // Hitung gap dan jumlah yang perlu diburn
                            let returnGap = minReturn.minReturnPercentage - actualReturn;
                            
                            switch (tokenomics.get(art.id)) {
                                case (?stats) {
                                    // Burn 5% dari circulating supply untuk setiap 1% gap
                                    let burnPercentage = (returnGap * 0.05);
                                    let burnAmount = stats.circulatingSupply * (burnPercentage / 100.0);
                                    
                                    // Execute burn
                                    burnTokens(art.id, burnAmount);
                                    
                                    // Update price setelah burning
                                    let priceIncrease = returnGap / 100.0; // Convert percentage to decimal
                                    for (i in Iter.range(0, artworks.size() - 1)) {
                                        if (artworks[i].id == art.id) {
                                            artworks[i] := {
                                                artworks[i] with
                                                currentPrice = art.currentPrice * (1.0 + priceIncrease)
                                            };
                                        };
                                    };
                                    
                                    // Log burning event (optional)
                                    Debug.print("Auto-burn executed for " # art.id);
                                    Debug.print("Burned amount: " # Float.toText(burnAmount));
                                    Debug.print("New price: " # Float.toText(art.currentPrice * (1.0 + priceIncrease)));
                                };
                                case null {};
                            };
                        };
                    };
                    case null {};
                };
            };
            
            lastReturnCheckTime := currentTime;
        };
    };


    private func updateUserBalances(buyer: Text, seller: Text, artworkId: Text, amount: Float, price: Float) {
        switch (userBalances.get(buyer), userBalances.get(seller)) {
            case (?buyerBalance, ?sellerBalance) {
                let totalCost = amount * price;
                
                // Update buyer
                buyerBalance.sevBalance -= totalCost;
                switch (buyerBalance.artTokens.get(artworkId)) {
                    case (?existing) { buyerBalance.artTokens.put(artworkId, existing + amount); };
                    case null { buyerBalance.artTokens.put(artworkId, amount); };
                };
                
                // Update seller
                sellerBalance.sevBalance += totalCost;
                switch (sellerBalance.artTokens.get(artworkId)) {
                    case (?existing) { 
                        if (existing >= amount) {
                            sellerBalance.artTokens.put(artworkId, existing - amount);
                        };
                    };
                    case null {};
                };
                
                // Update tokenomics
                switch (tokenomics.get(artworkId)) {
                    case (?stats) {
                        stats.volume24h += totalCost;
                    };
                    case null {};
                };
            };
            case _ {};
        };
    };

    // Public Functions
    public shared func topUpUSDT(user: Text, amount: Float) : async {
        ok: Bool;
        err: ?Text;
    } {
        if (amount <= 0) {
            return { ok = false; err = ?"Invalid amount" };
        };

        switch (userBalances.get(user)) {
            case (?balance) {
                balance.usdtBalance += amount;
                { ok = true; err = null }
            };
            case null { let newBalance = {
                    var usdtBalance = amount;
                    var sevBalance = 0.0;
                    var artTokens = HashMap.HashMap<Text, Float>(5, Text.equal, Text.hash);
                    var orders = Buffer.Buffer<Order>(50);
                };
                userBalances.put(user, newBalance);
                { ok = true; err = null }
            };
        }
    };

    public shared func convertUSDTtoSEV(user: Text, amount: Float) : async {
        ok: Bool;
        err: ?Text;
    } {
        if (not isWithinTradingWindow()) {
            return { ok = false; err = ?"Trading is currently closed" };
        };

        switch (userBalances.get(user)) {
            case (?balance) {
                if (balance.usdtBalance < amount) {
                    return { ok = false; err = ?"Insufficient USDT balance" };
                };

                let sevAmount = amount / baseTokenPrice;
                balance.usdtBalance -= amount;
                balance.sevBalance += sevAmount;
                { ok = true; err = null }
            };
            case null {
                { ok = false; err = ?"User not found" }
            }
        }
    };

    public shared func placeOrder(user: Text, artworkId: Text, orderType: OrderType, amount: Float, price: Float) : async {
        ok: Bool;
        err: ?Text;
    } {
        if (not isWithinTradingWindow()) {
            return { ok = false; err = ?"Trading is currently closed" };
        };

        // Validate user exists
        switch (userBalances.get(user)) {
            case (?balance) {
                // Check user type and restrictions
                let userType = getUserType(amount, artworkId);
                
                switch (userType) {
                    case (#Whale) {
                        // Check maximum whale holding
                        let currentHolding = switch (balance.artTokens.get(artworkId)) {
                            case (?holding) { holding };
                            case null { 0.0 };
                        };
                        
                        let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == artworkId });
                        switch (artwork) {
                            case (?art) {
                                if ((currentHolding + amount) / Float.fromInt(art.totalSupply) > maxWhalePurchase) {
                                    return { ok = false; err = ?"Exceeds maximum whale holding limit" };
                                };
                            };
                            case null { return { ok = false; err = ?"Artwork not found" }; };
                        };
                        
                        // Implement gradual buying/selling for whales
                        let maxOrderSize = amount / 5.0; // Split into 5 orders
                        for (i in Iter.range(0, 4)) {
                            let order: Order = {
                                id = Text.concat(user, Int.toText(Time.now()));
                                user = user;
                                artworkId = artworkId;
                                orderType = orderType;
                                amount = maxOrderSize;
                                price = price;
                                timestamp = Time.now();
                                var status = #Open;
                                var filledAmount = 0.0;
                            };
                            matchOrders(artworkId, order);
                        };
                    };
                    case (#Medium) {
                        // Implement gradual buying/selling for medium holders
                        let maxOrderSize = amount / 3.0; // Split into 3 orders
                        for (i in Iter.range(0, 2)) {
                            let order: Order = {
                                id = Text.concat(user, Int.toText(Time.now()));
                                user = user;
                                artworkId = artworkId;
                                orderType = orderType;
                                amount = maxOrderSize;
                                price = price;
                                timestamp = Time.now();
                                var status = #Open;
                                var filledAmount = 0.0;
                            };
                            matchOrders(artworkId, order);
                        };
                    };
                    case (#Retail) {
                        // Process retail order directly
                        let order: Order = {
                            id = Text.concat(user, Int.toText(Time.now()));
                            user = user;
                            artworkId = artworkId;
                            orderType = orderType;
                            amount = amount;
                            price = price;
                            timestamp = Time.now();
                            var status = #Open;
                            var filledAmount = 0.0;
                        };
                        matchOrders(artworkId, order);
                    };
                };
                
                { ok = true; err = null }
            };
            case null {
                { ok = false; err = ?"User not found" }
            };
        }
    };

    public shared func developerBurn(artworkId: Text, amount: Float) : async {
        ok: Bool;
        err: ?Text;
    } {
        let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == artworkId });
        switch (artwork) {
            case (?art) {
                if (Float.fromInt(art.developerSupply) < amount) {
                    return { ok = false; err = ?"Insufficient developer supply" };
                };
                
                burnTokens(artworkId, amount);
                { ok = true; err = null }
            };
            case null {
                { ok = false; err = ?"Artwork not found" }
            };
        }
    };

    // Query Functions
    public query func getArtworks() : async [Artwork] {
        Array.freeze(artworks)
    };

    public query func getUserBalance(user: Text) : async ?UserBalanceView {
    switch (userBalances.get(user)) {
        case (?balance) {
            let ordersView = Buffer.Buffer<OrderView>(50);
            for (order in balance.orders.vals()) {
                ordersView.add({
                    id = order.id;
                    user = order.user;
                    artworkId = order.artworkId;
                    orderType = order.orderType;
                    amount = order.amount;
                    price = order.price;
                    timestamp = order.timestamp;
                    status = order.status;
                    filledAmount = order.filledAmount;
                });
            };
            ?{
                usdtBalance = balance.usdtBalance;
                sevBalance = balance.sevBalance;
                artTokens = Iter.toArray(balance.artTokens.entries());
                orders = Buffer.toArray(ordersView);
            }
        };
        case null { null }
    }
};

    private func matchOrders(artworkId: Text, newOrder: Order) {
    switch (orderBooks.get(artworkId)) {
        case (?book) {
            // Add the new order to the order book
            book.add(newOrder);
            
            // Match orders based on price and type
            let orders = Buffer.toArray(book);
            let sortedOrders = sortOrders(orders);
            
            // Implement matching logic here based on price and order type
            // This is a basic implementation - you might want to enhance it
            for (order in sortedOrders.vals()) {
                if (order.id != newOrder.id and 
                    order.status != #Filled and 
                    order.status != #Cancelled) {
                    
                    if (newOrder.orderType == #Buy and order.orderType == #Sell and 
                        newOrder.price >= order.price) {
                        // Match buy order with sell order
                        let matchAmount = Float.min(
                            newOrder.amount - newOrder.filledAmount,
                            order.amount - order.filledAmount
                        );
                        
                        if (matchAmount > 0) {
                            // Update order status
                            newOrder.filledAmount += matchAmount;
                            order.filledAmount += matchAmount;
                            
                            // Update user balances
                            updateUserBalances(
                                newOrder.user,
                                order.user,
                                artworkId,
                                matchAmount,
                                order.price
                            );
                            
                            // Update order status
                            if (newOrder.filledAmount >= newOrder.amount) {
                                newOrder.status := #Filled;
                            } else {
                                newOrder.status := #Partial;
                            };
                            
                            if (order.filledAmount >= order.amount) {
                                order.status := #Filled;
                            } else {
                                order.status := #Partial;
                            };
                        };
                    };
                };
            };
        };
        case null {};
    };
};

    public query func getOrderBook(artworkId: Text) : async ?{
    buyOrders: [OrderView];
    sellOrders: [OrderView];
} {
    switch (orderBooks.get(artworkId)) {
        case (?book) {
            let buyOrders = Buffer.Buffer<OrderView>(100);
            let sellOrders = Buffer.Buffer<OrderView>(100);
            
            for (order in book.vals()) {
                if (order.status != #Filled and order.status != #Cancelled) {
                    let orderView : OrderView = {
                        id = order.id;
                        user = order.user;
                        artworkId = order.artworkId;
                        orderType = order.orderType;
                        amount = order.amount;
                        price = order.price;
                        timestamp = order.timestamp;
                        status = order.status;
                        filledAmount = order.filledAmount;
                    };
                    if (order.orderType == #Buy) {
                        buyOrders.add(orderView);
                    } else {
                        sellOrders.add(orderView);
                    };
                };
            };
            
            ?{
                buyOrders = Buffer.toArray(buyOrders);
                sellOrders = Buffer.toArray(sellOrders);
            }
        };
        case null { null }
    }
};

    public query func getTokenomics(artworkId: Text) : async ?TokenomicsView {
        switch (tokenomics.get(artworkId)) {
            case (?stats) {
                ?{
                    circulatingSupply = stats.circulatingSupply;
                    burnedSupply = stats.burnedSupply;
                    marketCap = stats.marketCap;
                    volume24h = stats.volume24h;
                    totalValueLocked = stats.totalValueLocked;
                }
            };
            case null { null }
        }
    };

    public query func getTradingWindowStatus() : async {
        isOpen: Bool;
        currentWindow: ?[Nat];
        nextWindow: ?[Nat];
    } {
        let currentHour = getCurrentHour();
        var currentWindow: ?[Nat] = null;
        var nextWindow: ?[Nat] = null;
        var foundCurrent = false;

        label l for (i in Iter.range(0, tradingWindows.size() - 1)) {
            let window = tradingWindows[i];
            if (currentHour >= window[0] and currentHour < window[1]) {
                currentWindow := ?window;
                nextWindow := if (i + 1 < tradingWindows.size()) {
                    ?tradingWindows[i + 1]
                } else {
                    ?tradingWindows[0]
                };
                foundCurrent := true;
                break l;
            };
        };

        if (not foundCurrent) {
            var foundNext = false;
            label l for (i in Iter.range(0, tradingWindows.size() - 1)) {
                let window = tradingWindows[i];
                if (window[0] > currentHour) {
                    nextWindow := ?window;
                    foundNext := true;
                    break l;
                };
            };
            
            if (not foundNext) {
                nextWindow := ?tradingWindows[0];
            };
        };

        {
            isOpen = isWithinTradingWindow();
            currentWindow = currentWindow;
            nextWindow = nextWindow;
        }
    };

    // Price Statistics
    public query func getPriceStats(artworkId: Text) : async ?{
        currentPrice: Float;
        priceChange24h: Float;
        priceChangeWeek: Float;
        priceChangeMonth: Float;
        priceChangeYear: Float;
    } {
        let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == artworkId });
        switch (artwork) {
            case (?art) {
                ?{
                    currentPrice = art.currentPrice;
                    priceChange24h = art.currentPrice * (1.0 + art.appreciationRates.daily) - art.currentPrice;
                    priceChangeWeek = art.currentPrice * (1.0 + art.appreciationRates.weekly) - art.currentPrice;
                    priceChangeMonth = art.currentPrice * (1.0 + art.appreciationRates.monthly) - art.currentPrice;
                    priceChangeYear = art.currentPrice * (1.0 + art.appreciationRates.yearly) - art.currentPrice;
                }
            };
            case null { null }
        }
    };
}