import random
import json

from datetime import datetime, timedelta
from pathlib import Path


# ==========================================
# CONFIGURATION
# ==========================================

TOTAL_TRADES = 3000

# Fixed seed makes the generated data reproducible
RANDOM_SEED = 42


# ==========================================
# SAMPLE CLIENTS
# ==========================================

CLIENTS = [
    "Client A",
    "Client B",
    "Client C",
    "Client D",
    "Client E",
    "Client F",
    "Client G",
    "Client H"
]


# ==========================================
# STOCK SYMBOLS AND SIMULATED PRICE RANGES
# ==========================================

STOCKS = {
    "RELIANCE": (1200, 1600),
    "TCS": (3000, 4000),
    "INFY": (1300, 2000),
    "HDFCBANK": (1400, 1900),
    "ICICIBANK": (900, 1400),
    "SBIN": (500, 1000),
    "ITC": (350, 550),
    "TATAMOTORS": (500, 1000),
    "WIPRO": (300, 600),
    "BHARTIARTL": (1000, 1800)
}


# ==========================================
# GENERATE RANDOM TIMESTAMP
# ==========================================

def generate_timestamp(rng):

    today = datetime.now().date()

    # Generate dates from the previous 7 days
    while True:

        days_ago = rng.randint(0, 6)

        trade_date = today - timedelta(days=days_ago)

        # Exclude Saturday and Sunday
        if trade_date.weekday() < 5:
            break

    # Simulated market hours: 9:15 AM to 3:30 PM
    hour = rng.randint(9, 15)

    if hour == 9:
        minute = rng.randint(15, 59)

    elif hour == 15:
        minute = rng.randint(0, 30)

    else:
        minute = rng.randint(0, 59)

    second = rng.randint(0, 59)

    trade_time = datetime(
        trade_date.year,
        trade_date.month,
        trade_date.day,
        hour,
        minute,
        second
    )

    return trade_time.isoformat()


# ==========================================
# GENERATE TRADE RECORDS
# ==========================================

def generate_trades(total=TOTAL_TRADES, seed=RANDOM_SEED):

    rng = random.Random(seed)

    trades = []

    stock_symbols = list(STOCKS.keys())

    for i in range(total):

        # Generate unique trade ID
        trade_id = f"TRD{1001 + i}"

        # Select random client
        client = rng.choice(CLIENTS)

        # Select random stock
        symbol = rng.choice(stock_symbols)

        # Generate quantity
        quantity = rng.choice([
            10, 20, 50, 100, 150,
            200, 250, 500, 1000
        ])

        # Generate price based on selected stock
        min_price, max_price = STOCKS[symbol]

        price = round(
            rng.uniform(min_price, max_price),
            2
        )

        # Generate timestamp
        timestamp = generate_timestamp(rng)

        # Create trade record
        trade = {
            "trade_id": trade_id,
            "client": client,
            "symbol": symbol,
            "quantity": quantity,
            "price": price,
            "timestamp": timestamp
        }

        trades.append(trade)

    return trades


# ==========================================
# SAVE TRADES TO JSON FILE
# ==========================================

def save_trades(trades):

    # Locate backend folder
    backend_dir = Path(__file__).resolve().parents[2]

    # Create data folder
    data_dir = backend_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    # JSON output file
    file_path = data_dir / "mock_trades.json"

    with open(file_path, "w", encoding="utf-8") as file:

        json.dump(
            trades,
            file,
            indent=4
        )

    print(f"Trades saved successfully!")
    print(f"File location: {file_path}")


# ==========================================
# MAIN EXECUTION
# ==========================================

if __name__ == "__main__":

    print("Generating mock BSE trade records...")

    trades = generate_trades()

    print(f"Total trades generated: {len(trades)}")

    save_trades(trades)

    print("Mock trade data generation completed!")

# ==========================================
# READ MOCK TRADES
# ==========================================

def get_all_trades():

    backend_dir = Path(__file__).resolve().parents[2]

    file_path = backend_dir / "data" / "mock_trades.json"

    if not file_path.exists():
        raise FileNotFoundError(
            "Mock trade data not found. "
            "Run mock_bse.py to generate the data first."
        )

    with open(file_path, "r", encoding="utf-8") as file:
        trades = json.load(file)

    return trades


# ==========================================
# GET PAGINATED TRADES
# ==========================================

def get_trades_batch(offset=0, limit=100):

    trades = get_all_trades()

    total = len(trades)

    # Select only the requested records
    batch = trades[offset:offset + limit]

    # Check whether more records are available
    has_more = (offset + len(batch)) < total

    return {
        "trades": batch,
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": has_more
    }