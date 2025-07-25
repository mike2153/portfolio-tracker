Alpha Vantage FX_WEEKLY Forex API Guide

The Alpha Vantage FX_WEEKLY API provides weekly historical and up-to-date foreign exchange (forex) data for any supported currency pair. The response includes the open, high, low, and close prices for each week.

API Endpoint

https://www.alphavantage.co/query?function=FX_WEEKLY&from_symbol=EUR&to_symbol=USD&apikey=YOUR_API_KEY

Example Call

https://www.alphavantage.co/query?function=FX_WEEKLY&from_symbol=EUR&to_symbol=USD&apikey=demo

Required Parameters

Parameter

Description

Example

function

The type of time series requested. For weekly forex data, use FX_WEEKLY.

FX_WEEKLY

from_symbol

The 3-letter currency code for the base currency.

EUR

to_symbol

The 3-letter currency code for the quote currency.

USD

apikey

Your unique API key from Alpha Vantage.

demo

Optional:

datatype: json (default) or csv

API Response (Sample)

{
    "Meta Data": {
        "1. Information": "Weekly Prices and Volumes for FX (open, high, low, close)",
        "2. From Symbol": "EUR",
        "3. To Symbol": "USD",
        "4. Last Refreshed": "2024-07-19 17:00:00",
        "5. Time Zone": "GMT+0"
    },
    "Time Series FX (Weekly)": {
        "2024-07-19": {
            "1. open": "1.0880",
            "2. high": "1.0900",
            "3. low": "1.0780",
            "4. close": "1.0820"
        },
        "2024-07-12": {
            "1. open": "1.0850",
            "2. high": "1.0980",
            "3. low": "1.0800",
            "4. close": "1.0910"
        }
    }
}

Response Fields Explained

Meta Data

Field

Description

1. Information

Description of the data set

2. From Symbol

The base currency (e.g., EUR)

3. To Symbol

The quote currency (e.g., USD)

4. Last Refreshed

Date and time of the latest data update (in GMT)

5. Time Zone

Time zone for the data timestamps

Time Series FX (Weekly)

Each key under "Time Series FX (Weekly)" is a week’s ending date (YYYY-MM-DD), with values showing:

1. open: Opening price for that week

2. high: Highest price during the week

3. low: Lowest price during the week

4. close: Closing price for the week

Usage Example

To fetch weekly EUR/USD data as JSON, use:

curl "https://www.alphavantage.co/query?function=FX_WEEKLY&from_symbol=EUR&to_symbol=USD&apikey=YOUR_API_KEY"

Notes

The latest entry contains up-to-date data for the current week.

Data is updated in real time.

For CSV output, add &datatype=csv to the URL.