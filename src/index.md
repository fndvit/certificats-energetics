---
toc: false
sidebar: false
---

<style>

.home {
  position: relative;
  --accent: #df2d5f;
  --title-color: #313539;
  --text-color: #58595a;
  max-width: 1180px;
  margin: 0 auto;
  font-family: var(--sans-serif);
  color: var(--text-color);
}

.home h1 {
  max-width: 640px;
  margin: 4rem 0 0;
  font-size: clamp(48px, 14vw, 90px);
  font-weight: 900;
  line-height: 1;
  color: var(--title-color);
}

.home h2 {
  max-width: none;
  margin: 90px 0 14px;
  font-size: 40px;
  font-weight: bold;
  line-height: normal;
  color: var(--text-color);
}

.home p {
  max-width: 778px;
  margin: 0;
  font-size: 20px;
  line-height: normal;
}

.accent {
  color: var(--accent);
}

.home-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.home-row--intro {
  margin-top: 50px;
}

.home a.home-link {
  flex-shrink: 0;
  font-size: 20px;
  font-weight: bold;
  color: var(--accent);
  text-decoration: none;
}

.home a.home-link:hover {
  text-decoration: underline;
}

.home a.home-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 50px;
  padding-bottom: 15px;
  overflow: hidden;
  background: white;
  border-radius: 20px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.1);
  color: var(--text-color);
  text-decoration: none;
}

.home-card img {
  display: block;
  width: 100%;
  height: 373px;
  object-fit: cover;
}

.home-card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 10px;
}

.home .home-card-title {
  max-width: none;
  font-weight: bold;
  color: var(--accent);
}

.home .home-card-body p:not(.home-card-title) {
  max-width: none;
}

.home-card:hover .home-card-title {
  text-decoration: underline;
}

.home-footer {
  margin-top: 4rem;
  padding: 30px 0 4rem;
  border-top: 1px solid rgba(223, 45, 95, 0.3);
}

.home-footer p {
  font-style: italic;
  font-weight: 300;
}

.home-footer a {
  color: inherit;
  text-decoration: underline;
}

#observablehq-footer {
  display: none;
}

/* Tile decorations. Blocks bleed past the 1180px column to the viewport edge;
   50vw includes the scrollbar, so clip the page horizontally. */
body {
  overflow-x: clip;
}

.home-deco {
  line-height: 0;
}

/* Hero: beside the title, flush right; above it when there's no room beside. */
.home[data-hero="beside"] .home-deco--hero {
  position: absolute;
  top: 0;
  right: calc(50% - 50vw);
}

.home[data-hero="above"] .home-deco--hero {
  margin: 1rem calc(50% - 50vw) 0 auto;
}

.home[data-hero="above"] h1 {
  margin-top: 1.5rem;
}

/* Side: a column in the left gutter beside the section; a strip above it when the gutter is too narrow. */
.home-section {
  position: relative;
}

.home[data-side="gutter"] .home-deco--side {
  position: absolute;
  top: 0;
  left: calc(50% - 50vw);
}

.home[data-side="strip"] .home-deco--side {
  margin: 60px 0 0 calc(50% - 50vw);
}

.home[data-side="strip"] .home-deco--side + h2 {
  margin-top: 24px;
}

/* Bottom: in flow, flush left, sitting on the footer rule. */
.home-deco--bottom {
  margin: 60px 0 0 calc(50% - 50vw);
}

.home .home-deco--bottom + .home-footer {
  margin-top: 24px;
}

@media (max-width: 640px) {
  .home h1 {
    margin-top: 2rem;
  }

  .home h2 {
    margin-top: 60px;
    font-size: 32px;
  }

  .home-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .home-card img {
    height: 220px;
  }
}

</style>

```js
import {mountDecoration} from './components/decorations.js';
```

```js
// Decoration layout for the current viewport. Only emits when it changes, so resizing
// within a breakpoint doesn't redraw the blocks.
const decoLayout = Generators.observe((notify) => {
  const home = document.querySelector('.home');
  const h1 = home.querySelector('h1');
  let previous;
  const compute = () => {
    const vw = document.documentElement.clientWidth;
    const cell = vw <= 640 ? 48 : vw <= 1100 ? 72 : 100;
    // Right edge of the title's actual text, so the hero block can sit beside it.
    const range = document.createRange();
    range.selectNodeContents(h1);
    const titleRight = range.getBoundingClientRect().right;
    const heroColumns = Math.min(6, Math.floor((vw - titleRight - 24) / cell));
    const layout = {
      cell,
      hero: heroColumns >= 3 ? 'beside' : 'above',
      heroColumns: heroColumns >= 3 ? heroColumns : 6,
      side: home.getBoundingClientRect().left >= cell + 16 ? 'gutter' : 'strip'
    };
    const key = JSON.stringify(layout);
    if (key !== previous) {
      previous = key;
      notify(layout);
    }
  };
  compute();
  document.fonts.ready.then(compute); // the title's width changes once the web font loads
  const observer = new ResizeObserver(compute);
  observer.observe(document.documentElement);
  return () => observer.disconnect();
});
```

```js
{
  const home = document.querySelector('.home');
  const {cell, hero, heroColumns, side} = decoLayout;
  home.dataset.hero = hero;
  home.dataset.side = side;
  const placements = [
    {id: 'deco-hero', rows: 2, columns: heroColumns, seed: 'hero'},
    side === 'gutter'
      ? {id: 'deco-side', rows: 4, columns: 1, seed: 'side'}
      : {id: 'deco-side', rows: 1, columns: 4, seed: 'side'},
    {id: 'deco-bottom', rows: 2, columns: 5, seed: 'bottom'}
  ];
  for (const {id, ...placement} of placements) {
    mountDecoration(document.getElementById(id), {...placement, cellSize: cell}, invalidation);
  }
}
```

<div class="home">
  <div class="home-deco home-deco--hero" id="deco-hero"></div>
  <h1>Certificats <span class="accent">Energètics</span> de Catalunya</h1>

  <div class="home-row home-row--intro">
    <p>És una iniciativa per <b>reimaginar la visualització de dades obertes de l'administració catalana</b> fent servir l'<em>Observable Framework</em>.</p>
    <a class="home-link" href="/codi.html">Dona-li una ullada al codi →</a>
  </div>

  <div class="home-section">
    <div class="home-deco home-deco--side" id="deco-side"></div>
    <h2>Eina de presa de decisions</h2>
  </div>
  <p>Presentació de diferents escenaris per tal de facilitar la presa de decisions.</p>

  <a class="home-card" href="/eina.html">
    <img src="/images/landingMap.png" alt="Previsualització de l'eina de presa de decisions">
    <div class="home-card-body">
      <p class="home-card-title">Lorem ipsum dolor sit amet consectetur</p>
      <p>Facilisi sed mauris aliquam tempus quam massa. Nibh pharetra nunc consectetur vel et nunc pellentesque.</p>
    </div>
  </a>

  <h2>TKTK Per què?</h2>
  <div class="home-row">
    <p>Lorem ipsum dolor sit amet consectetur. At neque <b>volutpat ut tempor egestas erat laoreet netus</b>. Facilisi sed mauris aliquam tempus quam massa. Nibh pharetra nunc consectetur vel et nunc pellentesque. Eget lectus mi at malesuada.</p>
    <a class="home-link" href="/metodologia.html">Llegeix la metodologia →</a>
  </div>

  <div class="home-deco home-deco--bottom" id="deco-bottom"></div>

  <div class="home-footer">
    <p>Si encara teniu dubtes, voleu col·laborar d'una altra manera, o la vostra empresa o organització vol patrocinar la iniciativa, poseu-vos en contacte amb <a href="mailto:pol@fundaciovit.org">pol@fundaciovit.org</a>.</p>
  </div>
</div>
