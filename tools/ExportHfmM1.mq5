// Export candle M1 dari server HFM untuk diproses oleh update-heatmap.mjs.
// Simpan file ini sebagai Script di MetaEditor, compile, lalu jalankan dari chart.
#property script_show_inputs

input string InpSymbol = "XAUUSD";
input datetime InpFrom = D'2021.10.23 00:00';
input datetime InpTo = D'2026.10.23 23:59';
input string InpFileName = "hfm_xauusd_m1.csv";

void OnStart()
{
   if(!SymbolSelect(InpSymbol, true))
   {
      Print("Gagal memilih symbol: ", InpSymbol);
      return;
   }

   MqlRates rates[];
   int copied = CopyRates(InpSymbol, PERIOD_M1, InpFrom, InpTo, rates);
   if(copied <= 0)
   {
      Print("Tidak ada candle. Pastikan histori M1 sudah dimuat dan symbol benar: ", InpSymbol);
      return;
   }
   ArraySetAsSeries(rates, false);

   int handle = FileOpen(InpFileName, FILE_WRITE | FILE_CSV | FILE_COMMON, ',');
   if(handle == INVALID_HANDLE)
   {
      Print("Gagal membuka file output. Error: ", GetLastError());
      return;
   }

   FileWrite(handle, "timestamp", "open", "high", "low", "close", "volume");
   for(int i = 0; i < copied; i++)
   {
      // Unix timestamp membuat CSV bebas dari timezone server HFM.
      FileWrite(handle, (long)rates[i].time, DoubleToString(rates[i].open, 5),
                DoubleToString(rates[i].high, 5), DoubleToString(rates[i].low, 5),
                DoubleToString(rates[i].close, 5), (long)rates[i].tick_volume);
   }
   FileClose(handle);
   Print("Selesai: ", copied, " candle diekspor ke Common\\Files\\", InpFileName);
}
