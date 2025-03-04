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

    private type StagedOrder = {
        user: Text;
        artworkId: Text;
        orderType: OrderType;
        totalAmount: Float;
        remainingAmount: Float;
        price: Float;
        stage: Nat;
        totalStages: Nat;
        stageAmount: Float;
        nextStageTime: Time.Time;
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
    [5, 7],   // Afternoon window: 05:00-09:00 GMT (12:00-14:00 WIB)
    [10, 14], // Evening window: 10:00-12:00 GMT (17:00-19:00 WIB)
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
        var lastLogin: Time.Time;                 
    };

    private type UserBalanceView = {
        usdtBalance: Float;
        sevBalance: Float;
        artTokens: [(Text, Float)];
        orders: [OrderView];
        lastLogin: Time.Time;
    };

    // State Variables
    private var userBalances = HashMap.HashMap<Text, UserBalance>(10, Text.equal, Text.hash);
    private var stagedOrders = HashMap.HashMap<Text, StagedOrder>(10, Text.equal, Text.hash);
    private var orderBooks = HashMap.HashMap<Text, Buffer.Buffer<Order>>(10, Text.equal, Text.hash);
    private var tokenomics = HashMap.HashMap<Text, Tokenomics>(10, Text.equal, Text.hash);
    private var lastPriceUpdate = Time.now();
    private var lastBurning = Time.now();
    private stable var userBalancesStable : [(Text, {
        usdtBalance: Float;
        sevBalance: Float;
        artTokens: [(Text, Float)];
        orders: [Order];
        lastLogin: Int;
    })] = [];

    system func preupgrade() {
        // Convert HashMap to stable array
        let tempEntries = Buffer.Buffer<(Text, {
            usdtBalance: Float;
            sevBalance: Float;
            artTokens: [(Text, Float)];
            orders: [Order];
            lastLogin: Int;
        })>(userBalances.size());
        
        for ((userId, userBalance) in userBalances.entries()) {
            tempEntries.add((
                userId, 
                {
                    usdtBalance = userBalance.usdtBalance;
                    sevBalance = userBalance.sevBalance;
                    artTokens = Iter.toArray(userBalance.artTokens.entries());
                    orders = Buffer.toArray(userBalance.orders);
                    lastLogin = userBalance.lastLogin;
                }
            ));
        };
        
        userBalancesStable := Buffer.toArray(tempEntries);
    };

    system func postupgrade() {
        // Convert stable array back to HashMap
        userBalances := HashMap.HashMap<Text, UserBalance>(10, Text.equal, Text.hash);
        
        for ((userId, stableBalance) in userBalancesStable.vals()) {
            let newUserBalance : UserBalance = {
                var usdtBalance = stableBalance.usdtBalance;
                var sevBalance = stableBalance.sevBalance;
                var artTokens = HashMap.fromIter<Text, Float>(
                    stableBalance.artTokens.vals(), 
                    10, Text.equal, Text.hash
                );
                var orders = Buffer.Buffer<Order>(stableBalance.orders.size());
                var lastLogin = stableBalance.lastLogin;
            };
            
            // Add orders to the buffer
            for (order in stableBalance.orders.vals()) {
                newUserBalance.orders.add(order);
            };
            
            userBalances.put(userId, newUserBalance);
        };
        
        // Clear stable storage after upgrade
        userBalancesStable := [];
    };
        
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
    ];


    // Initialize order books and tokenomics for each artwork
    private func initializeArtwork() {
        for (artwork in artworks.vals()) {
            let orders = Buffer.Buffer<Order>(100);
            orderBooks.put(artwork.id, orders);
            Debug.print("Initialized order book for " # artwork.id # ": " # debug_show(Buffer.toArray(orders)));
            
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
                
                let foundArtwork = Array.find<Artwork>(Array.freeze(artworks), func(a: Artwork) : Bool { 
                    a.id == artworkId 
                });
                
                let price = switch (foundArtwork) {
                    case (?art) { art.currentPrice };
                    case null { 0.0 };
                };
                
                stats.marketCap := stats.circulatingSupply * price;
                
                // Tangani optional foundArtwork untuk developerSupply
                let developerSupply = switch (foundArtwork) {
                    case (?art) { art.developerSupply };
                    case null { 0 };
                };
                stats.totalValueLocked := Float.fromInt(developerSupply) * price;
            };
            case null {};
        };
    };

    private func checkMinimumReturnAndBurn() {
        let currentTime = Time.now();
        let monthInNs = 30.44 * 24.0 * 3600.0 * 1000000000.0; // Rata-rata 1 bulan (30.44 hari)
        
        if (Float.fromInt(Int.abs(currentTime - lastReturnCheckTime)) >= monthInNs) {
            for (minReturn in minimumReturns.vals()) {
                let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a: Artwork) : Bool { 
                    a.id == minReturn.artworkId 
                });
                
                switch (artwork) {
                    case (?art) {
                        // Hitung actual return bulanan (tahunan dibagi 12)
                        let timeSinceLastPrice = Float.fromInt(Int.abs(currentTime - lastPriceUpdate)) / (365.0 * 24.0 * 3600.0 * 1000000000.0); // Dalam tahun
                        let actualReturnAnnual = ((art.currentPrice - art.lastPrice) / art.lastPrice) * (1.0 / timeSinceLastPrice) * 100.0;
                        let actualReturnMonthly = actualReturnAnnual / 12.0;
                        let minReturnMonthly = minReturn.minReturnPercentage / 12.0;
                        
                        // Jika return bulanan lebih rendah dari minimum
                        if (actualReturnMonthly < minReturnMonthly) {
                            let returnGap = minReturnMonthly - actualReturnMonthly;
                            switch (tokenomics.get(art.id)) {
                                case (?stats) {
                                    let burnPercentage = returnGap * 0.05; // 5% burn per 1% gap
                                    let burnAmount = stats.circulatingSupply * (burnPercentage / 100.0);
                                    
                                    burnTokens(art.id, burnAmount);
                                    
                                    let priceIncrease = returnGap / 100.0;
                                    for (i in Iter.range(0, artworks.size() - 1)) {
                                        if (artworks[i].id == art.id) {
                                            artworks[i] := {
                                                artworks[i] with
                                                currentPrice = art.currentPrice * (1.0 + priceIncrease)
                                            };
                                        };
                                    };
                                    
                                    Debug.print("Monthly auto-burn for " # art.id);
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
                
                buyerBalance.sevBalance -= totalCost;
                switch (buyerBalance.artTokens.get(artworkId)) {
                    case (?existing) { buyerBalance.artTokens.put(artworkId, existing + amount); };
                    case null { buyerBalance.artTokens.put(artworkId, amount); };
                };
                
                sellerBalance.sevBalance += totalCost;
                switch (sellerBalance.artTokens.get(artworkId)) {
                    case (?existing) { 
                        if (existing >= amount) {
                            sellerBalance.artTokens.put(artworkId, existing - amount);
                        };
                    };
                    case null {};
                };
                
                // Update tokenomics secara real-time
                switch (tokenomics.get(artworkId)) {
                    case (?stats) {
                        stats.volume24h += totalCost;
                        let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == artworkId });
                        switch (artwork) {
                            case (?art) {
                                stats.marketCap := stats.circulatingSupply * art.currentPrice;
                                stats.totalValueLocked := Float.fromInt(art.developerSupply) * art.currentPrice;
                            };
                            case null {};
                        };
                    };
                    case null {};
                };
            };
            case _ {};
        };
    };

    // Public Functions
    public shared func initializeUser(userId: Text) : async {
        ok: Bool;
        err: ?Text;
    } {
        switch (userBalances.get(userId)) {
            case (?balance) {
                balance.lastLogin := Time.now();
                { ok = true; err = null }
            };
            case null {
                // Buat data baru kalau pengguna belum ada
                let newBalance = {
                    var usdtBalance = 0.0;
                    var sevBalance = 0.0;
                    var artTokens = HashMap.HashMap<Text, Float>(5, Text.equal, Text.hash);
                    var orders = Buffer.Buffer<Order>(50);
                    var lastLogin = Time.now();
                };
                userBalances.put(userId, newBalance);
                { ok = true; err = null }
            };
        }
    };

    public shared func topUpUSDT(userId: Text, amount: Float) : async {
        ok: Bool;
        err: ?Text;
    } {
        if (amount < 0) {
            return { ok = false; err = ?"Jumlah tidak valid" };
        };

        switch (userBalances.get(userId)) {
            case (?balance) {
                balance.usdtBalance += amount;
                balance.lastLogin := Time.now();
                { ok = true; err = null }
            };
            case null {
                let newBalance = {
                    var usdtBalance = amount;
                    var sevBalance = 0.0;
                    var artTokens = HashMap.HashMap<Text, Float>(5, Text.equal, Text.hash);
                    var orders = Buffer.Buffer<Order>(50);
                    var lastLogin = Time.now();
                };
                userBalances.put(userId, newBalance);
                { ok = true; err = null }
            };
        }
    };

    public shared func convertUSDTtoSEV(user: Text, amount: Float) : async {
        ok: Bool;
        err: ?Text;
    } {

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

    switch (userBalances.get(user)) {
        case (?balance) {
            let userType = getUserType(amount, artworkId); // Fixed: Removed 'user' parameter
            let totalCost = amount * price;

            switch (orderType) {
                case (#Buy) {
                    if (balance.sevBalance < totalCost) {
                        return { ok = false; err = ?"Insufficient SEV balance" };
                    };
                };
                case (#Sell) {
                    let currentHolding = switch (balance.artTokens.get(artworkId)) {
                        case (?holding) { holding };
                        case null { 0.0 };
                    };
                    if (currentHolding < amount) {
                        return { ok = false; err = ?"Insufficient artwork tokens" };
                    };
                };
            };

            switch (userType) {
                case (#Whale) {
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

                    let totalStages = 5;
                    let stageAmount = amount / Float.fromInt(totalStages);
                    let stagedOrder: StagedOrder = {
                        user = user;
                        artworkId = artworkId;
                        orderType = orderType;
                        totalAmount = amount;
                        remainingAmount = amount;
                        price = price;
                        stage = 0;
                        totalStages = totalStages;
                        stageAmount = stageAmount;
                        nextStageTime = Time.now();
                    };
                    stagedOrders.put(user # artworkId, stagedOrder);
                    
                    label whaleLoop
                    for (i in Iter.range(0, totalStages - 1)) {
                        switch (stagedOrders.get(user # artworkId)) {
                            case (?currentOrder) {
                                if (currentOrder.remainingAmount <= 0.0) {
                                    break whaleLoop;
                                };
                                let order: Order = {
                                    id = Text.concat(user, Int.toText(Time.now() + i));
                                    user = user;
                                    artworkId = artworkId;
                                    orderType = orderType;
                                    amount = currentOrder.stageAmount;
                                    price = price;
                                    timestamp = Time.now();
                                    var status = #Open;
                                    var filledAmount = 0.0;
                                };
                                Debug.print("Processing stage " # Nat.toText(i + 1) # " for Whale " # user # " - Amount: " # Float.toText(currentOrder.stageAmount));
                                switch (orderType) {
                                    case (#Buy) {
                                        let subCost = currentOrder.stageAmount * price;
                                        balance.sevBalance -= subCost;
                                        let newAmount = if (currentOrder.stageAmount < 0.000001) { Float.max(currentOrder.stageAmount, 0.000001) } else { currentOrder.stageAmount };
                                        switch (balance.artTokens.get(artworkId)) {
                                            case (?existing) { balance.artTokens.put(artworkId, existing + newAmount); };
                                            case null { balance.artTokens.put(artworkId, newAmount); };
                                        };
                                        Debug.print("Whale " # user # " bought " # Float.toText(newAmount) # " of " # artworkId # " in stage " # Nat.toText(i + 1));
                                    };
                                    case (#Sell) {
                                        let subCost = currentOrder.stageAmount * price;
                                        let currentHolding = switch (balance.artTokens.get(artworkId)) {
                                            case (?holding) { holding };
                                            case null { 0.0 };
                                        };
                                        balance.artTokens.put(artworkId, currentHolding - currentOrder.stageAmount);
                                        balance.sevBalance += subCost;
                                        Debug.print("Whale " # user # " sold " # Float.toText(currentOrder.stageAmount) # " of " # artworkId # " in stage " # Nat.toText(i + 1));
                                    };
                                };
                                matchOrders(artworkId, order);

                                // Update staged order
                                let updatedOrder = {
                                    user = currentOrder.user;
                                    artworkId = currentOrder.artworkId;
                                    orderType = currentOrder.orderType;
                                    totalAmount = currentOrder.totalAmount;
                                    remainingAmount = Float.max(currentOrder.remainingAmount - currentOrder.stageAmount, 0.0);
                                    price = currentOrder.price;
                                    stage = currentOrder.stage + 1;
                                    totalStages = currentOrder.totalStages;
                                    stageAmount = currentOrder.stageAmount;
                                    nextStageTime = Time.now() + 86_400_000_000_000; // 5 detik ke depan
                                };
                                stagedOrders.put(user # artworkId, updatedOrder);

                                // Simulasi penundaan 5 detik
                                let delayNs = 86_400_000_000_000; // 5 detik
                                let startTime = Time.now();
                                while (Time.now() - startTime < delayNs) {
                                    // Busy wait untuk simulasi delay
                                };
                            };
                            case null { return { ok = false; err = ?"Staged order not found" }; };
                        };
                    };
                    stagedOrders.delete(user # artworkId);
                };
                case (#Medium) {
                    let currentHolding = switch (balance.artTokens.get(artworkId)) {
                        case (?holding) { holding };
                        case null { 0.0 };
                    };
                    let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == artworkId });
                    switch (artwork) {
                        case (?art) {
                            if ((currentHolding + amount) / Float.fromInt(art.totalSupply) > maxWhalePurchase) {
                                return { ok = false; err = ?"Exceeds maximum holding limit" };
                            };
                        };
                        case null { return { ok = false; err = ?"Artwork not found" }; };
                    };

                    let totalStages = 3;
                    let stageAmount = amount / Float.fromInt(totalStages);
                    let stagedOrder: StagedOrder = {
                        user = user;
                        artworkId = artworkId;
                        orderType = orderType;
                        totalAmount = amount;
                        remainingAmount = amount;
                        price = price;
                        stage = 0;
                        totalStages = totalStages;
                        stageAmount = stageAmount;
                        nextStageTime = Time.now();
                    };
                    stagedOrders.put(user # artworkId, stagedOrder);

                    label mediumLoop
                    for (i in Iter.range(0, totalStages - 1)) {
                        switch (stagedOrders.get(user # artworkId)) {
                            case (?currentOrder) {
                                if (currentOrder.remainingAmount <= 0.0) {
                                    break mediumLoop;
                                };
                                let order: Order = {
                                    id = Text.concat(user, Int.toText(Time.now() + i));
                                    user = user;
                                    artworkId = artworkId;
                                    orderType = orderType;
                                    amount = currentOrder.stageAmount;
                                    price = price;
                                    timestamp = Time.now();
                                    var status = #Open;
                                    var filledAmount = 0.0;
                                };
                                Debug.print("Processing stage " # Nat.toText(i + 1) # " for Medium " # user # " - Amount: " # Float.toText(currentOrder.stageAmount));
                                switch (orderType) {
                                    case (#Buy) {
                                        let subCost = currentOrder.stageAmount * price;
                                        balance.sevBalance -= subCost;
                                        let newAmount = if (currentOrder.stageAmount < 0.000001) { Float.max(currentOrder.stageAmount, 0.000001) } else { currentOrder.stageAmount };
                                        switch (balance.artTokens.get(artworkId)) {
                                            case (?existing) { balance.artTokens.put(artworkId, existing + newAmount); };
                                            case null { balance.artTokens.put(artworkId, newAmount); };
                                        };
                                        Debug.print("Medium " # user # " bought " # Float.toText(newAmount) # " of " # artworkId # " in stage " # Nat.toText(i + 1));
                                    };
                                    case (#Sell) {
                                        let subCost = currentOrder.stageAmount * price;
                                        let currentHolding = switch (balance.artTokens.get(artworkId)) {
                                            case (?holding) { holding };
                                            case null { 0.0 };
                                        };
                                        balance.artTokens.put(artworkId, currentHolding - currentOrder.stageAmount);
                                        balance.sevBalance += subCost;
                                        Debug.print("Medium " # user # " sold " # Float.toText(currentOrder.stageAmount) # " of " # artworkId # " in stage " # Nat.toText(i + 1));
                                    };
                                };
                                matchOrders(artworkId, order);

                                // Update staged order
                                let updatedOrder = {
                                    user = currentOrder.user;
                                    artworkId = currentOrder.artworkId;
                                    orderType = currentOrder.orderType;
                                    totalAmount = currentOrder.totalAmount;
                                    remainingAmount = Float.max(currentOrder.remainingAmount - currentOrder.stageAmount, 0.0);
                                    price = currentOrder.price;
                                    stage = currentOrder.stage + 1;
                                    totalStages = currentOrder.totalStages;
                                    stageAmount = currentOrder.stageAmount;
                                    nextStageTime = Time.now() + 86_400_000_000_000; // 5 detik ke depan
                                };
                                stagedOrders.put(user # artworkId, updatedOrder);

                                // Simulasi penundaan 5 detik
                                let delayNs = 86_400_000_000_000; // 5 detik
                                let startTime = Time.now();
                                while (Time.now() - startTime < delayNs) {
                                    // Busy wait untuk simulasi delay
                                };
                            };
                            case null { return { ok = false; err = ?"Staged order not found" }; };
                        };
                    };
                    stagedOrders.delete(user # artworkId);
                };
                case (#Retail) {
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
                    Debug.print("Before buy - sevBalance: " # Float.toText(balance.sevBalance) # ", artTokens: " # debug_show(Iter.toArray(balance.artTokens.entries())));
                    switch (orderType) {
                        case (#Buy) {
                            balance.sevBalance -= totalCost;
                            let newAmount = if (amount < 0.000001) { Float.max(amount, 0.000001) } else { amount };
                            switch (balance.artTokens.get(artworkId)) {
                                case (?existing) { balance.artTokens.put(artworkId, existing + newAmount); };
                                case null { balance.artTokens.put(artworkId, newAmount); };
                            };
                            Debug.print("Retail " # user # " bought " # Float.toText(newAmount) # " of " # artworkId);
                        };
                        case (#Sell) {
                            let currentHolding = switch (balance.artTokens.get(artworkId)) {
                                case (?holding) { holding };
                                case null { 0.0 };
                            };
                            balance.artTokens.put(artworkId, currentHolding - amount);
                            balance.sevBalance += totalCost;
                            Debug.print("Retail " # user # " sold " # Float.toText(amount) # " of " # artworkId);
                        };
                    };
                    Debug.print("After buy - sevBalance: " # Float.toText(balance.sevBalance) # ", artTokens: " # debug_show(Iter.toArray(balance.artTokens.entries())));
                    matchOrders(artworkId, order);
                };
            };
            { ok = true; err = null }
        };
        case null { { ok = false; err = ?"User not found" } };
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

    // Fungsi untuk ambil data pengguna
    public query func getUserBalance(userId: Text) : async ?UserBalanceView {
    Debug.print("Fetching balance for user: " # userId);
    switch (userBalances.get(userId)) {
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
        let result = ?{
            usdtBalance = balance.usdtBalance;
            sevBalance = balance.sevBalance;
            artTokens = Iter.toArray(balance.artTokens.entries());
            orders = Buffer.toArray(ordersView);
            lastLogin = balance.lastLogin;
        };
        Debug.print("Returning balance: " # debug_show(result));
        result
        };
        case null {
        Debug.print("No balance found for user: " # userId);
        ?{ usdtBalance = 0.0; sevBalance = 0.0; artTokens = []; orders = []; lastLogin = Time.now() } // Default value
        }
    }
    };

    private func matchOrders(artworkId: Text, newOrder: Order) {
        switch (orderBooks.get(artworkId)) {
            case (?book) {
                book.add(newOrder); // Pastikan order baru ditambahkan ke orderBooks
                let orders = Buffer.toArray(book);
                let sortedOrders = sortOrders(orders);
                var totalVolume = 0.0;
                var totalCost = 0.0;
                
                for (order in sortedOrders.vals()) {
                    if (order.id != newOrder.id and 
                        order.status != #Filled and 
                        order.status != #Cancelled) {
                        
                        if (newOrder.orderType == #Buy and order.orderType == #Sell and 
                            newOrder.price >= order.price) {
                            let matchAmount = Float.min(
                                newOrder.amount - newOrder.filledAmount,
                                order.amount - order.filledAmount
                            );
                            
                            if (matchAmount > 0) {
                                newOrder.filledAmount += matchAmount;
                                order.filledAmount += matchAmount;
                                updateUserBalances(newOrder.user, order.user, artworkId, matchAmount, order.price);
                                totalVolume += matchAmount;
                                totalCost += matchAmount * order.price;
                                
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
                
                // Selalu perbarui harga berdasarkan permintaan
                if (totalVolume > 0 or newOrder.orderType == #Buy or newOrder.orderType == #Sell) {
                    let avgPrice = if (totalVolume > 0) { totalCost / totalVolume } else { newOrder.price };
                    label breakLoop for (i in Iter.range(0, artworks.size() - 1)) {
                        if (artworks[i].id == artworkId) {
                            let supplyImpact = newOrder.amount / Float.fromInt(artworks[i].totalSupply);
                            let priceChangeFactor = if (newOrder.orderType == #Buy) { 1.0 + supplyImpact * 0.1 } else { 1.0 - supplyImpact * 0.1 };
                            let oldPrice = artworks[i].currentPrice;
                            artworks[i] := {
                                artworks[i] with
                                lastPrice = oldPrice;
                                currentPrice = artworks[i].currentPrice * priceChangeFactor
                            };
                            Debug.print("Demand-based price update for " # artworkId # ": " # Float.toText(artworks[i].currentPrice));
                            break breakLoop;
                        };
                    };
                };
                
                // Perbarui tokenomics setelah transaksi
                switch (tokenomics.get(artworkId)) {
                    case (?stats) {
                        let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == artworkId });
                        switch (artwork) {
                            case (?art) {
                                // Hitung ulang circulating supply berdasarkan total kepemilikan user
                                var newCirculatingSupply: Float = 0.0;
                                for ((userId, userBalance) in userBalances.entries()) {
                                    switch (userBalance.artTokens.get(artworkId)) {
                                        case (?holding) {
                                            newCirculatingSupply += holding;
                                        };
                                        case null {};
                                    };
                                };
                                stats.circulatingSupply := newCirculatingSupply;
                                stats.marketCap := stats.circulatingSupply * art.currentPrice;
                                stats.totalValueLocked := Float.fromInt(art.developerSupply) * art.currentPrice;
                                Debug.print("Updated tokenomics for " # artworkId # ": circulatingSupply=" # Float.toText(stats.circulatingSupply) # ", marketCap=" # Float.toText(stats.marketCap));
                            };
                            case null {};
                        };
                    };
                    case null {};
                };
            };
            case null {};
        };
    };
    
    public query func getTokenomics(artworkId: Text) : async ?{ whale: Float; medium: Float; retail: Float; burned: Float; developer: Float } {
        switch (orderBooks.get(artworkId), tokenomics.get(artworkId)) {
            case (?book, ?stats) {
                var whaleAmount: Float = 0.0;
                var mediumAmount: Float = 0.0;
                var retailAmount: Float = 0.0;

                for ((userId, userBalance) in userBalances.entries()) {
                    switch (userBalance.artTokens.get(artworkId)) {
                        case (?holding) {
                            let userType = getUserType(holding, artworkId); // Line 1067: Hapus parameter userId yang berlebih
                            Debug.print("User " # userId # " holding " # Float.toText(holding) # " of " # artworkId # ", type: " # debug_show(userType));
                            switch (userType) {
                                case (#Whale) { whaleAmount += holding; };
                                case (#Medium) { mediumAmount += holding; };
                                case (#Retail) { retailAmount += holding; };
                            };
                        };
                        case null {};
                    };
                };

                let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a: Artwork) : Bool { a.id == artworkId });
                switch (artwork) {
                    case (?art) {
                        let totalSupply = Float.fromInt(art.totalSupply);
                        let burned = stats.burnedSupply;
                        let developer = Float.fromInt(art.developerSupply);
                        ?{
                            whale = whaleAmount;
                            medium = mediumAmount;
                            retail = retailAmount;
                            burned = burned;
                            developer = developer;
                        }
                    };
                    case null { null };
                };
            };
            case _ { null };
        }
    };

    public query func getOrderBook(artworkId: Text) : async ?[OrderView] {
        switch (orderBooks.get(artworkId)) {
            case (?book) {
                let ordersView = Buffer.Buffer<OrderView>(book.size());
                for (order in book.vals()) {
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
                ?Buffer.toArray(ordersView)
            };
            case null { null }
        }
    };

    public query func getStagedOrders(user: Text, artworkId: Text) : async ?StagedOrder {
        let key = user # artworkId;
        Debug.print("Fetching staged order for key: " # key);
        switch (stagedOrders.get(key)) {
            case (?order) {
                Debug.print("Found staged order: " # debug_show(order));
                ?order
            };
            case null {
                Debug.print("No staged order found for " # key);
                null
            };
        }
    };

    public query func getTradingWindowStatus() : async {
        isOpen: Bool;
        currentWindow: ?[Nat];
        nextWindow: ?[Nat];
    } {
        let currentHour = getCurrentHour();
        Debug.print("Current hour: " # Nat.toText(currentHour));
        Debug.print("Trading windows: " # debug_show(tradingWindows));
        var currentWindow: ?[Nat] = null;
        var nextWindow: ?[Nat] = null;
        var foundCurrent = false;

        label loop1 for (i in Iter.range(0, tradingWindows.size() - 1)) {
            let window = tradingWindows[i];
            if (currentHour >= window[0] and currentHour < window[1]) {
                currentWindow := ?[window[0], window[1]];
                nextWindow := if (i + 1 < tradingWindows.size()) {
                    ?[tradingWindows[i + 1][0], tradingWindows[i + 1][1]]
                } else {
                    ?[tradingWindows[0][0], tradingWindows[0][1]]
                };
                foundCurrent := true;
                break loop1;
            };
        };
        
        if (not foundCurrent) {
            var foundNext = false;
            label l for (i in Iter.range(0, tradingWindows.size() - 1)) {
                let window = tradingWindows[i];
                if (window[0] > currentHour) {
                    nextWindow := ?[window[0], window[1]]; // Pastikan dua elemen
                    foundNext := true;
                    break l;
                };
            };
            
            if (not foundNext) {
                nextWindow := ?[tradingWindows[0][0], tradingWindows[0][1]];
            };
        };

        Debug.print("Returning: isOpen=" # debug_show(isWithinTradingWindow()) # ", currentWindow=" # debug_show(currentWindow) # ", nextWindow=" # debug_show(nextWindow));
        {
            isOpen = isWithinTradingWindow();
            currentWindow = currentWindow;
            nextWindow = nextWindow
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
    }
};