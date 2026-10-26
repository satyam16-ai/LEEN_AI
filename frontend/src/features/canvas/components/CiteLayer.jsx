import { BOARD_HEIGHT, BOARD_WIDTH } from '../engine/board';

const percent = (value, total) => `${(value / total) * 100}%`;

/**
 * Invisible buttons over the citation chips the player drew, so a tap opens the cited page.
 * It sits inside the camera-transformed layer, so the buttons follow zoom with the ink.
 */
export function CiteLayer({ cites, onOpen }) {
  if (!cites?.length) return null;
  return (
    <div className="absolute inset-0">
      {cites.map(({ key, x, y, w, h, doc, page, title }) => (
        <button
          key={key}
          type="button"
          className="absolute cursor-pointer rounded-lg focus-ring hover:bg-primary/10"
          style={{
            left: percent(x, BOARD_WIDTH),
            top: percent(y, BOARD_HEIGHT),
            width: percent(w, BOARD_WIDTH),
            height: percent(h, BOARD_HEIGHT),
          }}
          aria-label={`Open ${title ?? 'your book'}, page ${page}`}
          onClick={() => onOpen({ doc, page, title })}
        />
      ))}
    </div>
  );
}
