import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Float "mo:base/Float";
import Text "mo:base/Text";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Nat8 "mo:base/Nat8";
import Blob "mo:base/Blob";
import Int "mo:base/Int";
import Random "mo:base/Random";
import Order "mo:base/Order";

actor class RWA() {
    private stable var baseTokenSymbol: Text = "SEV";
    private stable var baseTokenPrice: Float = 20.0; // USDT
    
    private stable var whaleThreshold: Float = 0.25; // 25% of total supply
    private stable var mediumThreshold: Float = 0.10; // 10% of total supply
    private stable var maxWhalePurchase: Float = 0.30; // 30% maximum whale holding
    
    private type OrderType = {
        #Buy;
        #Sell;
    };

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
        userType: UserType; // Tambahkan field ini
    };

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

    private let tradingWindows: [[Nat]] = [
        [1, 3],   // Morning window: 01:00-03:00 GMT (08:00-10:00 WIB)
        [5, 7],   // Afternoon window: 05:00-09:00 GMT (12:00-14:00 WIB)
        [10, 12], // Evening window: 10:00-12:00 GMT (17:00-19:00 WIB)
        [13, 17]  // Night window: 15:00-17:00 GMT (22:00-00:00 WIB)
    ];

    private type AppreciationRates = {
        hourly: Float;
        daily: Float;
        weekly: Float;
        monthly: Float;
        yearly: Float;
    };

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

    private type Tokenomics = {
        var circulatingSupply: Float;
        var burnedSupply: Float;
        var marketCap: Float;
        var volume24h: Float;
        var totalValueLocked: Float;
        var priceChangeHistory: Buffer.Buffer<Float>;
    };

    private type TokenomicsView = {
        circulatingSupply: Float;
        burnedSupply: Float;
        marketCap: Float;
        volume24h: Float;
        totalValueLocked: Float;
        whale: Float;
        medium: Float;
        retail: Float;
        developer: Float;
        burned: Float;
        priceChangeHistory: [Float]; // Tambah ini
    };

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

    private var userBalances = HashMap.HashMap<Text, UserBalance>(10, Text.equal, Text.hash);
    private var baseRanging: HashMap.HashMap<Text, Float> = HashMap.HashMap<Text, Float>(10, Text.equal, Text.hash);
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

    // Helper function to round a Float to 1 decimal place
    private func roundFloat(x: Float, decimals: Nat): Float {
        let factor = Float.pow(10.0, Float.fromInt(decimals));
        let scaled = x * factor;
        let rounded = if (scaled >= 0.0) { Float.floor(scaled + 0.5) } else { Float.ceil(scaled - 0.5) };
        rounded / factor
    };

    system func preupgrade() {
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
            
            for (order in stableBalance.orders.vals()) {
                newUserBalance.orders.add(order);
            };
            
            userBalances.put(userId, newUserBalance);
        };
        
        userBalancesStable := [];
    };
        
    private type MinimumReturn = {
        artworkId: Text;
        minReturnPercentage: Float;
    };

    private let minimumReturns: [MinimumReturn] = [
        { artworkId = "UTD"; minReturnPercentage = 15.38 },
        { artworkId = "ORY"; minReturnPercentage = 16.67 },
        { artworkId = "BDO"; minReturnPercentage = 25.00 },
        { artworkId = "POL"; minReturnPercentage = 25.00 },
        { artworkId = "LFA"; minReturnPercentage = 13.64 }
    ];

    private stable var lastReturnCheckTime = Time.now();

    private func getCurrentHour() : Nat {
        let currentTime = Time.now();
        let hoursFromEpoch = Int.abs(currentTime) / (3600 * 1000000000);
        hoursFromEpoch % 24
    };

    private func isWithinTradingWindow() : Bool {
        let currentHour = getCurrentHour();
        for (window in tradingWindows.vals()) {
            if (window[0] > window[1]) {
                if (currentHour >= window[0] or currentHour < window[1]) {
                    return true;
                };
            } else if (currentHour >= window[0] and currentHour < window[1]) {
                return true;
            };
        };
        false
    };

    private func sortOrders(orders: [Order]) : [Order] {
        Array.sort<Order>(orders, func(a: Order, b: Order) : Order.Order {
            if (a.price < b.price) { #less }
            else if (a.price > b.price) { #greater }
            else { #equal }
        })
    };

    private func convertBufferToArray<T>(buffer: Buffer.Buffer<T>) : [T] {
        Buffer.toArray(buffer)
    };

    private var artworks: [var Artwork] = [var 
        {
            id = "UTD";
            name = "Untitled";
            artist = "Jean-Michel Basquiat";
            symbol = "SEV_UTD";
            totalSupply = 375_000;
            developerSupply = 187_500;
            currentPrice = 7_500_000.0;
            lastPrice = 6_500_000.0;
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
            totalSupply = 350_000;
            developerSupply = 175_000;
            currentPrice = 7_000_000.0;
            lastPrice = 6_000_000.0;
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
            totalSupply = 250_000;
            developerSupply = 125_000;
            currentPrice = 5_000_000.0;
            lastPrice = 4_000_000.0;
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
            totalSupply = 625_000;
            developerSupply = 312_500;
            currentPrice = 12_500_000.0;
            lastPrice = 10_000_000.0;
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
            totalSupply = 500_000;
            developerSupply = 250_000;
            currentPrice = 12_500_000.0;
            lastPrice = 11_000_000.0;
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

    private func initializeArtwork() {
        for (artwork in artworks.vals()) {
            let orders = Buffer.Buffer<Order>(100);
            orderBooks.put(artwork.id, orders);

            let initialCirculating = Float.fromInt(artwork.totalSupply) / 2.0;
            let initialTokenomics: Tokenomics = {
                var circulatingSupply = initialCirculating;
                var burnedSupply = 0.0;
                var marketCap = initialCirculating * artwork.currentPrice;
                var volume24h = 0.0;
                var totalValueLocked = Float.fromInt(artwork.developerSupply) * artwork.currentPrice;
                var priceChangeHistory = Buffer.Buffer<Float>(10); // Tambah ini
            };
            tokenomics.put(artwork.id, initialTokenomics);
        }
    };

    initializeArtwork();

    private func getUserType(amount: Float, artworkId: Text) : UserType {
        let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a: Artwork) : Bool { a.id == artworkId });
        switch (artwork) {
            case (?art) {
                let percentage = amount / Float.fromInt(art.totalSupply); // Langsung dari Nat ke Float
                if (percentage > whaleThreshold) { #Whale }
                else if (percentage > mediumThreshold) { #Medium }
                else { #Retail }
            };
            case null { #Retail }
        }
    };

    private func burnTokens(artworkId: Text, amount: Float) {
    switch (tokenomics.get(artworkId)) {
        case (?stats) {
            let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a: Artwork) : Bool { a.id == artworkId });
            switch (artwork) {
                case (?art) {
                    let totalSupplyFloat = Float.fromInt(art.totalSupply); // Nat -> Float langsung
                    let maxBurnable = totalSupplyFloat * 0.5; // Maksimal burn 50% dari total supply
                    if (stats.burnedSupply + amount > maxBurnable) {
                        return;
                    };
                    let roundedAmount = roundFloat(amount, 1);
                    stats.burnedSupply += roundedAmount;

                    let burnAmountInt = Float.toInt(roundedAmount); // Float -> Int
                    let burnAmountNat = Int.abs(burnAmountInt); // Int -> Nat pake Int.abs

                    let index = Array.indexOf<Artwork>(art, Array.freeze(artworks), func(a: Artwork, b: Artwork) : Bool { a.id == b.id });
                    switch (index) {
                        case (?idx) {
                            artworks[idx] := {
                                id = art.id;
                                name = art.name;
                                artist = art.artist;
                                symbol = art.symbol;
                                totalSupply = Nat.sub(art.totalSupply, burnAmountNat);
                                developerSupply = art.developerSupply;
                                currentPrice = art.currentPrice;
                                lastPrice = art.lastPrice;
                                description = art.description;
                                lastSaleDate = art.lastSaleDate;
                                appreciationRates = art.appreciationRates;
                                status = art.status;
                            };
                            stats.marketCap := roundFloat(stats.circulatingSupply * art.currentPrice, 1);
                            stats.totalValueLocked := roundFloat(Float.fromInt(art.developerSupply) * art.currentPrice, 1);

                            let initialTotalSupply = totalSupplyFloat / 2.0;
                            let currentSupply = (totalSupplyFloat - stats.burnedSupply);
                            let priceIncreaseFactor = initialTotalSupply / currentSupply;
                            artworks[idx] := {
                                id = art.id;
                                name = art.name;
                                artist = art.artist;
                                symbol = art.symbol;
                                totalSupply = Nat.sub(art.totalSupply, burnAmountNat);
                                developerSupply = art.developerSupply;
                                currentPrice = roundFloat(art.currentPrice * priceIncreaseFactor, 1);
                                lastPrice = art.lastPrice;
                                description = art.description;
                                lastSaleDate = art.lastSaleDate;
                                appreciationRates = art.appreciationRates;
                                status = art.status;
                            };
                        };
                        case null {
                            Debug.print("Artwork index not found for ID: " # artworkId);
                        };
                    };
                };
                case null {
                    Debug.print("Artwork not found for ID: " # artworkId);
                };
            };
        };
        case null {
            Debug.print("Tokenomics not found for ID: " # artworkId);
        };
    };
};

    private func checkMinimumReturnAndBurn() {
    let currentTime = Time.now();
    let dayInNs = 24.0 * 3600.0 * 1000000000.0;

    if (Float.fromInt(Int.abs(currentTime - lastReturnCheckTime)) >= dayInNs) {
        for (minReturn in minimumReturns.vals()) {
            let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == minReturn.artworkId });
            switch (artwork) {
                case (?art) {
                    let dailyReturnTarget = minReturn.minReturnPercentage / 365.0; // Target harian
                    let actualReturnDaily = ((art.currentPrice - art.lastPrice) / art.lastPrice) * 100.0;
                    if (actualReturnDaily < dailyReturnTarget) {
                        let returnGap = dailyReturnTarget - actualReturnDaily;
                        switch (tokenomics.get(art.id)) {
                            case (?stats) {
                                let burnPercentage = returnGap * 0.05;
                                let burnAmount = roundFloat(stats.circulatingSupply * (burnPercentage / 100.0), 1);
                                let maxBurnable = Float.fromInt(art.totalSupply) * 0.5;
                                if (stats.burnedSupply + burnAmount <= maxBurnable) {
                                    burnTokens(art.id, burnAmount);
                                    let priceIncreaseFactor = 1.0 + (returnGap / 100.0);
                                    let newPrice = roundFloat(art.currentPrice * priceIncreaseFactor, 1);
                                    let priceChangePercent = ((newPrice - art.currentPrice) / art.currentPrice) * 100;

                                    for (i in Iter.range(0, artworks.size() - 1)) {
                                        if (artworks[i].id == art.id) {
                                            artworks[i] := {
                                                artworks[i] with
                                                currentPrice = newPrice
                                            };
                                        };
                                    };
                                    stats.marketCap := roundFloat(stats.circulatingSupply * newPrice, 1);
                                    stats.priceChangeHistory.add(priceChangePercent); // Tambah ke history
                                    if (stats.priceChangeHistory.size() > 10) {
                                        ignore stats.priceChangeHistory.remove(0); // Ganti removeAt jadi remove
                                    };
                                };
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

    private func updatePrices() {
        let currentTime = Time.now();
        let hoursPassed = Float.fromInt(Int.abs(currentTime - lastPriceUpdate)) / (3600.0 * 1000000000.0);
        if (hoursPassed < 1.0) { return; }; // Update setiap jam

        for (i in Iter.range(0, artworks.size() - 1)) {
            let artwork = artworks[i];
            let lastChange = (artwork.currentPrice - artwork.lastPrice) / artwork.lastPrice; // Persentase kenaikan terakhir
            let rangeMin = lastChange - 0.0001; // -0.01%
            let rangeMax = lastChange + 0.0001; // +0.01%
            let fluctuation = rangeMin + (getRandomRange() * (rangeMax - rangeMin)); // Ranging di sekitar kenaikan
            let newPrice = roundFloat(artwork.currentPrice * (1.0 + fluctuation), 1);

            artworks[i] := {
                artwork with
                lastPrice = artwork.currentPrice;
                currentPrice = newPrice;
            };
        };
        lastPriceUpdate := currentTime;
        checkMinimumReturnAndBurn();
    };

    private func getRandomRange() : Float {
        let seed = Int.abs(Time.now());
        let pseudoRandom = Float.fromInt(seed % 100) / 100.0; // 0.0 - 1.0
        pseudoRandom
    };

    private func updateUserBalances(buyer: Text, seller: Text, artworkId: Text, amount: Float, price: Float) {
        switch (userBalances.get(buyer), userBalances.get(seller)) {
            case (?buyerBalance, ?sellerBalance) {
                let totalCost = roundFloat(amount * price, 1);

                buyerBalance.sevBalance -= totalCost;
                switch (buyerBalance.artTokens.get(artworkId)) {
                    case (?existing) { buyerBalance.artTokens.put(artworkId, roundFloat(existing + amount, 1)); };
                    case null { buyerBalance.artTokens.put(artworkId, roundFloat(amount, 1)); };
                };

                sellerBalance.sevBalance += totalCost;
                switch (sellerBalance.artTokens.get(artworkId)) {
                    case (?existing) {
                        if (existing >= amount) {
                            sellerBalance.artTokens.put(artworkId, roundFloat(existing - amount, 1));
                        };
                    };
                    case null {};
                };

                switch (tokenomics.get(artworkId)) {
                    case (?stats) {
                        let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == artworkId });
                        switch (artwork) {
                            case (?art) {
                                stats.circulatingSupply := 0.0;
                                for ((_, userBalance) in userBalances.entries()) {
                                    switch (userBalance.artTokens.get(artworkId)) {
                                        case (?holding) { stats.circulatingSupply += roundFloat(holding, 1); };
                                        case null {};
                                    };
                                };
                                stats.marketCap := roundFloat(stats.circulatingSupply * art.currentPrice, 1);
                                stats.totalValueLocked := roundFloat(Float.fromInt(art.developerSupply) * art.currentPrice, 1);
                                stats.volume24h += roundFloat(totalCost, 1);
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

        let roundedAmount = roundFloat(amount, 1);
        if (roundedAmount > 1000000.0) {
            return { ok = false; err = ?"Top-up amount exceeds maximum limit of 1,000,000 USDT" };
        };

        switch (userBalances.get(userId)) {
            case (?balance) {
                balance.usdtBalance += roundedAmount;
                balance.lastLogin := Time.now();
                { ok = true; err = null }
            };
            case null {
                let newBalance = {
                    var usdtBalance = roundedAmount;
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
            let userType = getUserType(amount, artworkId);
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
                        nextStageTime = Time.now() + 86_400_000_000_000;
                        userType = #Whale; // Tambahkan userType
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
                                matchOrders(artworkId, order);

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
                                    nextStageTime = Time.now() + 86_400_000_000_000;
                                    userType = currentOrder.userType;
                                };
                                stagedOrders.put(user # artworkId, updatedOrder);

                                let delayNs = 86_400_000_000_000;
                                let startTime = Time.now();
                                while (Time.now() - startTime < delayNs) {};
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
                        nextStageTime = Time.now() + 86_400_000_000_000;
                        userType = #Medium; // Tambahkan userType
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
                                matchOrders(artworkId, order);

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
                                    nextStageTime = Time.now() + 86_400_000_000_000;
                                    userType = currentOrder.userType;
                                };
                                stagedOrders.put(user # artworkId, updatedOrder);

                                let delayNs = 86_400_000_000_000;
                                let startTime = Time.now();
                                while (Time.now() - startTime < delayNs) {};
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
                    matchOrders(artworkId, order);
                };
            };
            { ok = true; err = null }
        };
        case null { { ok = false; err = ?"User not found" } };
    }
};

private func matchOrders(artworkId: Text, newOrder: Order) {
    switch (orderBooks.get(artworkId)) {
        case (?book) {
            book.add(newOrder);
            let orders = Buffer.toArray(book);
            let sortedOrders = sortOrders(orders);
            var totalVolume = 0.0;
            var totalCost = 0.0;

            for (order in sortedOrders.vals()) {
                if (order.id != newOrder.id and order.status != #Filled and order.status != #Cancelled) {
                    if (newOrder.orderType == #Buy and order.orderType == #Sell and newOrder.price >= order.price) {
                        let matchAmount = Float.min(newOrder.amount - newOrder.filledAmount, order.amount - order.filledAmount);
                        if (matchAmount > 0) {
                            newOrder.filledAmount += matchAmount;
                            order.filledAmount += matchAmount;
                            updateUserBalances(newOrder.user, order.user, artworkId, matchAmount, order.price);
                            totalVolume += matchAmount;
                            totalCost += matchAmount * order.price;

                            if (newOrder.filledAmount >= newOrder.amount) { newOrder.status := #Filled; }
                            else { newOrder.status := #Partial; };
                            if (order.filledAmount >= order.amount) { order.status := #Filled; }
                            else { order.status := #Partial; };
                        };
                    } else if (newOrder.orderType == #Sell and order.orderType == #Buy and newOrder.price <= order.price) {
                        let matchAmount = Float.min(newOrder.amount - newOrder.filledAmount, order.amount - order.filledAmount);
                        if (matchAmount > 0) {
                            newOrder.filledAmount += matchAmount;
                            order.filledAmount += matchAmount;
                            updateUserBalances(order.user, newOrder.user, artworkId, matchAmount, order.price);
                            totalVolume += matchAmount;
                            totalCost += matchAmount * order.price;

                            if (newOrder.filledAmount >= newOrder.amount) { newOrder.status := #Filled; }
                            else { newOrder.status := #Partial; };
                            if (order.filledAmount >= order.amount) { order.status := #Filled; }
                            else { order.status := #Partial; };
                        };
                    };
                };
            };

            if (totalVolume > 0) {
                let avgPrice = roundFloat(totalCost / totalVolume, 1);
                let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == artworkId });
                switch (artwork, tokenomics.get(artworkId)) {
                    case (?art, ?stats) {
                        let supplyImpact = newOrder.amount / Float.fromInt(art.totalSupply);
                        let priceChangeFactor = if (newOrder.orderType == #Buy) { 
                            1.0 + (supplyImpact * 100.0) 
                        } else { 
                            1.0 - (supplyImpact * 100.0) 
                        };
                        let newPrice = roundFloat(art.currentPrice * priceChangeFactor, 1);
                        let priceChangePercent = ((newPrice - art.currentPrice) / art.currentPrice) * 100; // Hitung perubahan

                        for (i in Iter.range(0, artworks.size() - 1)) {
                            if (artworks[i].id == artworkId) {
                                artworks[i] := {
                                    artworks[i] with
                                    lastPrice = art.currentPrice;
                                    currentPrice = newPrice;
                                };
                            };
                        };

                        if (newOrder.orderType == #Buy) {
                            stats.circulatingSupply -= roundFloat(totalVolume, 1);
                        } else {
                            stats.circulatingSupply += roundFloat(totalVolume, 1);
                        };
                        stats.marketCap := roundFloat(stats.circulatingSupply * newPrice, 1);
                        stats.volume24h += roundFloat(totalCost, 1);
                        stats.priceChangeHistory.add(priceChangePercent); // Tambah ke history
                        if (stats.priceChangeHistory.size() > 10) {
                            ignore stats.priceChangeHistory.remove(0); // Ganti removeAt jadi remove
                        };
                    };
                    case _ {};
                };
            };
            orderBooks.put(artworkId, Buffer.fromArray(sortedOrders));
        };
        case null {
            let newBook = Buffer.Buffer<Order>(100);
            newBook.add(newOrder);
            orderBooks.put(artworkId, newBook);
        };
    };
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

    public query func getArtworks() : async [Artwork] {
        Array.freeze(artworks)
    };

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
                ?{ usdtBalance = 0.0; sevBalance = 0.0; artTokens = []; orders = []; lastLogin = Time.now() }
            }
        }
    };
    
    public query func getOrderBook(artworkId: Text) : async ?[OrderView] {
        switch (orderBooks.get(artworkId)) {
            case (?book) {
                let ordersView = Buffer.Buffer<OrderView>(book.size());
                for (order in book.vals()) {
                    if (order.artworkId == artworkId) {
                        ordersView.add({
                            id = order.id;
                            user = order.user;
                            artworkId = order.artworkId;
                            orderType = order.orderType;
                            amount = roundFloat(order.amount, 1);
                            price = roundFloat(order.price, 1);
                            timestamp = order.timestamp;
                            status = order.status;
                            filledAmount = roundFloat(order.filledAmount, 1);
                        });
                    };
                };
                ?Buffer.toArray(ordersView)
            };
            case null { null }
        }
    };

    public query func getTokenomics(artworkId: Text) : async ?TokenomicsView {
    switch (tokenomics.get(artworkId)) {
        case (?stats) {
            let artwork = Array.find<Artwork>(Array.freeze(artworks), func(a) { a.id == artworkId });
            switch (artwork) {
                case (?art) {
                    var whale = 0.0;
                    var medium = 0.0;
                    var retail = 0.0;
                    for ((_, userBalance) in userBalances.entries()) {
                        switch (userBalance.artTokens.get(artworkId)) {
                            case (?holding) {
                                let percentage = holding / Float.fromInt(art.totalSupply);
                                if (percentage > whaleThreshold) { whale += holding; }
                                else if (percentage > mediumThreshold) { medium += holding; }
                                else { retail += holding; }
                            };
                            case null {};
                        };
                    };
                    ?{
                        circulatingSupply = stats.circulatingSupply;
                        burnedSupply = stats.burnedSupply;
                        marketCap = stats.marketCap;
                        volume24h = stats.volume24h;
                        totalValueLocked = stats.totalValueLocked;
                        whale = whale;
                        medium = medium;
                        retail = retail;
                        developer = Float.fromInt(art.developerSupply);
                        burned = stats.burnedSupply;
                        priceChangeHistory = Buffer.toArray(stats.priceChangeHistory);
                    }
                };
                case null { null };
            };
        };
        case null { null };
    };
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

    public shared func testBurning(userId: Text, artworkId: Text, amount: Float) : async { ok: Bool; err: ?Text } {
    // Pastikan amount valid
    if (amount <= 0.0) {
        return { ok = false; err = ?"Invalid amount: must be greater than 0" };
    };

    // Panggil developerBurn dan tangani hasilnya
    let burnResult = await developerBurn(artworkId, amount);
    switch (burnResult) {
        case ({ ok = true; err = null }) {
            // Burning berhasil, lanjutkan ke update balance
            switch (userBalances.get(userId)) {
                case (?balance) {
                    let sevCost = amount * 20.0; // 1 SEV_UTD = 20 SEV
                    if (balance.sevBalance < sevCost) {
                        return { ok = false; err = ?"Insufficient SEV balance to burn" };
                    };
                    balance.sevBalance -= sevCost;
                    userBalances.put(userId, balance); // Update balance
                    { ok = true; err = null }
                };
                case null {
                    { ok = false; err = ?"User not found" }
                }
            }
        };
        case ({ ok = false; err = ?errMsg }) {
            // Burning gagal
            { ok = false; err = ?("Failed to burn tokens: " # errMsg) }
        };
        case (_) {
            // Kasus lain, misal developerBurn tidak mengembalikan err
            { ok = false; err = ?"Unexpected error during burning" }
        }
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
                    nextWindow := ?[window[0], window[1]];
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
                let timeSinceLastSale = Float.fromInt(Int.abs(Time.now() - art.lastSaleDate)) / (24.0 * 3600.0 * 1000000000.0);
                let actualChange = (art.currentPrice - art.lastPrice) / art.lastPrice * 100.0;
                return ?{
                    currentPrice = roundFloat(art.currentPrice, 1);
                    priceChange24h = if (timeSinceLastSale >= 1.0) { roundFloat(actualChange / timeSinceLastSale, 1) } else { 0.0 };
                    priceChangeWeek = if (timeSinceLastSale >= 7.0) { roundFloat(actualChange / (timeSinceLastSale / 7.0), 1) } else { 0.0 };
                    priceChangeMonth = if (timeSinceLastSale >= 30.0) { roundFloat(actualChange / (timeSinceLastSale / 30.0), 1) } else { 0.0 };
                    priceChangeYear = roundFloat(actualChange, 1);
                };
            };
            case null {
                return null;
            };
        };
    };
}