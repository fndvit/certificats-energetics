import { html } from "npm:htl";
import {
  computePosition,
  flip,
  shift,
  offset,
  arrow,
} from "npm:@floating-ui/dom";

export function InfoTooltip(text) {
  const arrowEl = html`<div class="info-tooltip-arrow"></div>`;
  const popup = html`<div class="info-tooltip-popup" role="tooltip">
    <span class="info-tooltip-text">${text}</span>
    ${arrowEl}
  </div>`;

  const node = html`<span class="info-tooltip" tabindex="0">
    <svg
      width="14"
      height="14"
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M30 0C46.5685 0 60 13.4315 60 30C60 46.5685 46.5685 60 30 60C13.4315 60 0 46.5685 0 30C0 13.4315 13.4315 0 30 0ZM27.8535 25.3057V43H33.3623V25.3057H27.8535ZM30.6084 18.2676C29.5766 18.2676 28.8264 18.5019 28.3584 18.9697C27.8904 19.4377 27.6563 20.074 27.6562 20.8779V21.0039C27.6562 21.8079 27.8904 22.4497 28.3584 22.9297C28.8264 23.3977 29.5764 23.6318 30.6084 23.6318C31.6162 23.6318 32.3543 23.3976 32.8223 22.9297C33.3021 22.4617 33.542 21.8197 33.542 21.0039V20.8779C33.542 20.074 33.3023 19.4377 32.8223 18.9697C32.3543 18.5018 31.6162 18.2676 30.6084 18.2676Z"
        fill="currentColor"
      />
    </svg>
  </span>`;

  async function position() {
    const { x, y, placement, middlewareData } = await computePosition(
      node,
      popup,
      {
        placement: "top",
        middleware: [
          offset(8),
          flip(),
          shift({ padding: 8 }),
          arrow({ element: arrowEl }),
        ],
      },
    );
    Object.assign(popup.style, { left: `${x}px`, top: `${y}px` });

    const { x: ax, y: ay } = middlewareData.arrow ?? {};
    const side = placement.split("-")[0];
    const staticSide = {
      top: "bottom",
      bottom: "top",
      left: "right",
      right: "left",
    }[side];
    Object.assign(arrowEl.style, {
      left: ax != null ? `${ax}px` : "",
      top: ay != null ? `${ay}px` : "",
      right: "",
      bottom: "",
      [staticSide]: "-4px",
    });
    popup.dataset.placement = side;
  }

  const onOutsideTouch = (e) => {
    if (!node.contains(e.target)) hide();
  };

  function show() {
    // No content yet: keep the icon but don't show an empty bubble
    if (!text) return;
    if (!popup.isConnected) document.body.appendChild(popup);
    position();
    popup.classList.add("visible");
    document.addEventListener("touchstart", onOutsideTouch);
  }

  function hide() {
    popup.classList.remove("visible");
    document.removeEventListener("touchstart", onOutsideTouch);
  }

  popup.addEventListener("transitionend", () => {
    if (!popup.classList.contains("visible")) popup.remove();
  });

  node.addEventListener("mouseenter", show);
  node.addEventListener("focus", show);
  node.addEventListener("mouseleave", hide);
  node.addEventListener("blur", hide);

  node.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (popup.classList.contains("visible")) hide();
    else show();
  });

  return node;
}
