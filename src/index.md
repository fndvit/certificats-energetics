---
toc: false
sidebar: false
---

<style>

.home {
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

<div class="home">
  <h1>Certificats <span class="accent">Energètics</span> de Catalunya</h1>

  <div class="home-row home-row--intro">
    <p>És una iniciativa per <b>reimaginar la visualització de dades obertes de l'administració catalana</b> fent servir l'<em>Observable Framework</em>.</p>
    <a class="home-link" href="/codi.html">Dona-li una ullada al codi →</a>
  </div>

  <h2>Eina de presa de decisions</h2>
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

  <div class="home-footer">
    <p>Si encara teniu dubtes, voleu col·laborar d'una altra manera, o la vostra empresa o organització vol patrocinar la iniciativa, poseu-vos en contacte amb <a href="mailto:pol@fundaciovit.org">pol@fundaciovit.org</a>.</p>
  </div>
</div>
