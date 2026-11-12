/**
 * Entry do worker do Luau, empacotado como script clássico.
 *
 * O pacote publica esse entry como módulo ES e não o expõe no mapa `exports`,
 * por isso o caminho relativo até node_modules. O Vite o transforma em script
 * clássico (worker.format = 'iife') com a camada de compat como banner, para
 * funcionar em WebView que não cria module workers (Chrome < 80).
 */
import '../../node_modules/@luau-rs/luau/dist/worker.js';
