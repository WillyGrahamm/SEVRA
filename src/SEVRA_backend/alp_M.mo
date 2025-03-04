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

actor class RWA() {
    // Token Configuration
    private stable var baseTokenSymbol: Text = "SEV";
    private stable var baseTokenPrice: Float = 100.0; // USDT
    private stable var annualAppreciation: Float = 30.0; // 30% annual appreciation target
    
    // Market Configuration
    private stable var whaleThreshold: Float = 0.10; // 10% of total supply
    private stable var mediumThreshold: Float = 0.05; // 5% of total supply
    private stable var maxWhalePurchase: Float = 0.30; // 30% maximum whale holding
    
    // Trading Windows (in hours from day start, UTC)
    private let tradingWindows: [[Nat]] = [
        [2, 4],   // First window: 02:00-04:00
        [8, 10],  // Second window: 08:00-10:00
        [14, 16], // Third window: 14:00-16:00
        [20, 22]  // Fourth window: 20:00-22:00
    ];

    // Artwork Configuration
    private type Artwork = {
        id: Text;
        name: Text;
        symbol: Text;
        totalSupply: Nat;
        developerSupply: Nat;
        currentPrice: Float;
        lastPrice: Float;
    };

    private let artworks: [Artwork] = [
        {
            id = "MON";
            name = "Mona Lisa";
            symbol = "SEV_MON";
            totalSupply = 1_000_000;
            developerSupply = 500_000;
            currentPrice = 150.0;
            lastPrice = 150.0;
        },
        {
            id = "STN";
            name = "Starry Night";
            symbol = "SEV_STN";
            totalSupply = 800_000;
            developerSupply = 400_000;
            currentPrice = 120.0;
            lastPrice = 120.0;
        },
        {
            id = "SCM";
            name = "The Scream";
            symbol = "SEV_SCM";
            totalSupply = 600_000;
            developerSupply = 300_000;
            currentPrice = 100.0;
            lastPrice = 100.0;
        },
        {
            id = "GRL";
            name = "Girl with a Pearl Earring";
            symbol = "SEV_GRL";
            totalSupply = 500_000;
            developerSupply = 250_000;
            currentPrice = 90.0;
            lastPrice = 90.0;
        },
        {
            id = "BSK";
            name = "Basquiat Crown";
            symbol = "SEV_BSK";
            totalSupply = 400_000;
            developerSupply = 200_000;
            currentPrice = 80.0;
            lastPrice = 80.0;
        }
    ];

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
    };

    // State Variables
    private var userBalances = HashMap.HashMap<Text, UserBalance>(10, Text.equal, Text.hash);
    private var lastPriceUpdate = Time.now();
    private var lastBurning = Time.now();

    // Helper Functions
    private func getCurrentHour() : Nat {
        let currentTime = Time.now();
        let hoursFromEpoch = Int.abs(currentTime) / (3600 * 1000000000);
        hoursFromEpoch % 24
    };

    private func isWithinTradingWindow() : Bool {
        let currentHour = getCurrentHour();
        for (window in tradingWindows.vals()) {
            if (currentHour >= window[0] and currentHour < window[1]) {
                return true;
            };
        };
        false
    };

    private func getUserType(amount: Float, artworkId: Text) : UserType {
        let artwork = Array.find<Artwork>(artworks, func(a: Artwork) : Bool { a.id == artworkId });
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
            case null {
                let newBalance = {
                    var usdtBalance = amount;
                    var sevBalance = 0.0; // Changed from 0 to 0.0 to match Float type
                    var artTokens = HashMap.HashMap<Text, Float>(5, Text.equal, Text.hash);
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

    public shared func buyArtToken(user: Text, artworkId: Text, amount: Float) : async {
        ok: Bool;
        err: ?Text;
    } {
        if (not isWithinTradingWindow()) {
            return { ok = false; err = ?"Trading is currently closed" };
        };

        let artwork = Array.find<Artwork>(artworks, func(a: Artwork) : Bool { a.id == artworkId });
        
        switch (artwork) {
            case (?art) {
                switch (userBalances.get(user)) {
                    case (?balance) {
                        let userType = getUserType(amount, artworkId);
                        
                        switch (userType) {
                            case (#Whale) {
                                let currentHolding = switch (balance.artTokens.get(artworkId)) {
                                    case (?holding) { holding };
                                    case null { 0.0 }; // Changed from 0 to 0.0 for Float consistency
                                };
                                
                                if ((currentHolding + amount) / Float.fromInt(art.totalSupply) > maxWhalePurchase) {
                                    return { ok = false; err = ?"Exceeds maximum whale holding limit" };
                                };
                            };
                            case _ {};
                        };

                        let sevCost = amount * art.currentPrice;
                        if (balance.sevBalance < sevCost) {
                            return { ok = false; err = ?"Insufficient SEV balance" };
                        };

                        let currentHolding = switch (balance.artTokens.get(artworkId)) {
                            case (?holding) { holding + amount };
                            case null { amount };
                        };
                        
                        balance.artTokens.put(artworkId, currentHolding);
                        balance.sevBalance -= sevCost;
                        { ok = true; err = null }
                    };
                    case null {
                        { ok = false; err = ?"User not found" }
                    };
                }
            };
            case null {
                { ok = false; err = ?"Artwork not found" }
            }
        }
    };

    // Query Functions
    public query func getArtworks() : async [Artwork] {
        artworks
    };

    public query func getUserBalance(user: Text) : async ?{
        usdtBalance: Float;
        sevBalance: Float;
        artTokens: [(Text, Float)];
    } {
        switch (userBalances.get(user)) {
            case (?balance) {
                ?{
                    usdtBalance = balance.usdtBalance;
                    sevBalance = balance.sevBalance;
                    artTokens = Iter.toArray(balance.artTokens.entries());
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
    }
}