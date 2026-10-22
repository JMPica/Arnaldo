// Tipos compartidos entre el motor en producción y la investigación.
// Todo el código de src/core es puro y determinista: no hace E/S, no lee el
// reloj ni usa aleatoriedad, de modo que el backtest y el motor real ejecutan
// exactamente la misma lógica.

export interface Candle {
  ts: number; // apertura de la vela, segundos UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Side = "long" | "short";
export type Timeframe = "1h" | "4h" | "1d";

export const TF_SECONDS: Record<Timeframe, number> = { "1h": 3600, "4h": 14400, "1d": 86400 };

export interface Position {
  side: Side;
  qty: number; // en unidades del subyacente (BTC)
  entryPrice: number;
  entryTs: number;
  stop: number; // stop de protección vigente
  initialStop: number;
  strategyId: string;
  barsHeld: number; // velas del timeframe de la estrategia desde la entrada
  highestClose: number; // para stops dinámicos
  lowestClose: number;
  entryFee: number;
  fundingPaid: number;
  tradeId: string;
}

export type SignalAction = "enter_long" | "enter_short" | "exit" | "hold";

export interface Signal {
  action: SignalAction;
  stop?: number; // precio del stop propuesto (entradas) o nuevo stop (hold)
  reason: string;
  features?: Record<string, number>;
}

export interface StrategyContext<P> {
  bars: Candle[]; // velas cerradas del timeframe de la estrategia, la última es la más reciente
  position: Position | null;
  params: P;
}

export interface Strategy<P = Record<string, number>> {
  family: string;
  timeframe: Timeframe;
  description: string;
  warmup(params: P): number; // velas necesarias antes de poder decidir
  decide(ctx: StrategyContext<P>): Signal;
}

export interface StrategyConfig {
  id: string; // identificador estable, p.ej. "donchian:1d:55-20-3"
  family: string;
  timeframe: Timeframe;
  params: Record<string, number>;
}

export interface RiskLimits {
  maxLeverage: number; // 2
  riskPerTrade: number; // 0.01
  maxPositions: number; // 1
  maxDrawdown: number; // 0.20 → suspende nuevas entradas
  minLot: number; // tamaño mínimo de orden (BTC)
  lotStep: number; // incremento de tamaño
  maxOrdersPerDay: number;
  maxPriceDeviation: number; // desviación máxima precio orden vs referencia
  maxDataAgeSec: number; // datos de mercado más viejos → no operar
}

export interface CostModel {
  takerFee: number; // fracción del nocional por lado
  slippage: number; // fracción del precio por lado
  fundingPerHour: number | null; // si null se usa la serie histórica / dato real
}

export const DEFAULT_LIMITS: RiskLimits = {
  maxLeverage: 2,
  riskPerTrade: 0.01,
  maxPositions: 1,
  maxDrawdown: 0.2,
  minLot: 0.0001,
  lotStep: 0.0001,
  maxOrdersPerDay: 12,
  maxPriceDeviation: 0.03,
  maxDataAgeSec: 2 * 3600 + 600,
};

// Kraken Futures (PF_XBTUSD), nivel de comisiones inicial: 0,05 % taker.
// Deslizamiento conservador de 3 pb por lado para órdenes pequeñas.
export const DEFAULT_COSTS: CostModel = { takerFee: 0.0005, slippage: 0.0003, fundingPerHour: null };

export interface Fill {
  tradeId: string;
  kind: "entry" | "exit";
  reason: string;
  side: Side;
  qty: number;
  price: number;
  fee: number;
  ts: number;
}

export interface ClosedTrade {
  tradeId: string;
  strategyId: string;
  side: Side;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  entryTs: number;
  exitTs: number;
  grossPnl: number;
  fees: number;
  funding: number;
  netPnl: number;
  returnOnEquity: number; // netPnl / equity en la entrada
  rMultiple: number; // netPnl / riesgo inicial
  exitReason: string;
  entryReason: string;
}
