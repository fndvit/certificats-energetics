/**
 * Tile decorations: small blocks of the site's tile style (@vit-foundation/gen-tilesets).
 *
 * The style is the editor's export zip, unchanged. Framework only publishes files a page names
 * literally, so the tiles are read from the zip on demand instead of from a `tiles/` folder.
 * To update the design, replace `src/decorations/tileset-ce.zip` with a new export.
 */
import {FileAttachment} from 'observablehq:stdlib';
import {loadTilesetFile} from '@vit-foundation/gen-tilesets';
import {TileDecorationRenderer} from '@vit-foundation/gen-tilesets/render';

const zip = await FileAttachment('../decorations/tileset-ce.zip').zip();

/** The decoration style shared by every placement. */
export const style = loadTilesetFile(await zip.file('tileset.json').json());

// Operations flagged `reseedOnLoad` in the style mix this into their seed. The renderer defaults
// it to 0 (same picture every load), so draw it once per page load; module scope keeps it stable
// across re-renders (e.g. on breakpoint changes) within that load.
const loadSalt = crypto.getRandomValues(new Uint32Array(1))[0];

// A zip entry has no MIME type, and a browser won't decode an SVG blob without one.
const TYPES = {svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg'};

// One blob URL per file, shared by every decoration on the page. The provider must keep its
// identity across renderers, so it lives at module level.
const urls = new Map();
const provider = (ref) => {
  const path = ref.meta.src;
  if (!urls.has(path)) {
    const type = TYPES[path.split('.').pop()];
    urls.set(
      path,
      zip
        .file(path)
        .arrayBuffer()
        .then((bytes) => URL.createObjectURL(new Blob([bytes], {type})))
    );
  }
  return urls.get(path).then((src) => ({src}));
};

/**
 * Draws a decoration block into `host`, destroyed when `invalidation` resolves.
 * Pass the `invalidation` of the block that calls this, so a re-run cleans up the old one.
 *
 * @param {HTMLElement} host - Empty element to draw into
 * @param {{rows: number, columns: number, cellSize: number, seed?: string}} placement
 * @param {Promise<void>} invalidation
 */
export function mountDecoration(host, {rows, columns, cellSize, seed}, invalidation) {
  // Absolutely positioned hosts are shrink-to-fit; give them the block's exact width.
  host.style.width = `${columns * cellSize}px`;
  const renderer = new TileDecorationRenderer(host, {
    style,
    rows,
    columns,
    cellSize,
    options: {provider, seed, loadSalt, onAssetError: (error) => console.warn('Tile decoration', error)}
  });
  invalidation.then(() => {
    renderer.destroy();
    host.style.width = '';
  });
}
