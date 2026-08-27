// Is the app running in production mode (on Render)?
const isProduction = import.meta.env.PROD;

// 明確指定的後端位址（host:port，不含 scheme）。Render 上以環境變數設定。
const explicitBaseUrl = (import.meta.env.VITE_BACKEND_BASE_URL || '').trim();

const isLoopback = (host: string) =>
	/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(host);

// 若後端位址指向 localhost，但頁面本身不是從 localhost 開啟的
//（例如透過 tailscale funnel 用手機連進來），那個位址對瀏覽器來說是「手機自己」，
// 一定連不到。這種情況改走同源，由 vite proxy / 反向代理轉發到後端。
const useExplicit =
	explicitBaseUrl !== '' &&
	!(isLoopback(explicitBaseUrl) && !isLoopback(window.location.host));

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

// Export the full URLs for both HTTP and WebSocket connections
export const API_URL = useExplicit
	? `${isProduction ? 'https' : 'http'}://${explicitBaseUrl}`
	: ''; // 空字串 = 同源相對路徑，例如 fetch('/api/...')

export const WS_URL = useExplicit
	? `${isProduction ? 'wss' : 'ws'}://${explicitBaseUrl}`
	: `${wsProtocol}//${window.location.host}/ws`;
