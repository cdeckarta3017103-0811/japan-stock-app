import streamlit as st
import yfinance as yf
import pandas as pd
import plotly.graph_objs as go

# --- App 設定 ---
st.set_page_config(page_title="簡易日股分析器", layout="wide")

st.title("🇯🇵 日股即時分析 App")
st.write("請輸入日本股票代號 (例如: 7203 為豐田汽車, 9984 為軟銀)")

# --- 側邊欄輸入 ---
ticker_symbol = st.sidebar.text_input("輸入股票代號 (純數字)", value="7203")
period = st.sidebar.selectbox("時間範圍", ["1mo", "3mo", "6mo", "1y", "5y"], index=3)

# --- 處理代號 (日股需加上 .T) ---
if ticker_symbol:
    ticker_full = f"{ticker_symbol}.T"
    
    try:
        # 抓取數據
        stock = yf.Ticker(ticker_full)
        hist = stock.history(period=period)
        info = stock.info

        if hist.empty:
            st.error("找不到數據，請確認代號是否正確。")
        else:
            # --- 顯示基本資訊 ---
            col1, col2, col3 = st.columns(3)
            current_price = info.get('currentPrice', 'N/A')
            col1.metric("目前股價 (JPY)", current_price)
            col2.metric("本益比 (PE)", info.get('trailingPE', 'N/A'))
            col3.metric("市值 (兆)", f"{info.get('marketCap', 0)/1000000000000:.2f} T")

            st.subheader(f"{info.get('longName', ticker_full)} 股價走勢")

            # --- 繪製互動式圖表 (Plotly) ---
            fig = go.Figure()
            
            # K線圖
            fig.add_trace(go.Candlestick(x=hist.index,
                            open=hist['Open'],
                            high=hist['High'],
                            low=hist['Low'],
                            close=hist['Close'],
                            name='K線'))
            
            fig.update_layout(xaxis_rangeslider_visible=False, height=500)
            st.plotly_chart(fig, use_container_width=True)

            # --- 顯示詳細數據 ---
            with st.expander("查看詳細歷史數據"):
                st.dataframe(hist.sort_index(ascending=False))

    except Exception as e:
        st.error(f"發生錯誤: {e}")
