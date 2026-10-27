// See https://observablehq.com/framework/config for documentation.
export default {
  // The app’s title; used in the sidebar and webpage titles.
  title: 'Certificats Energètics de Catalunya',

  // The pages and sections in the sidebar. If you don’t specify this option,
  // all pages will be listed in alphabetical order. Listing pages explicitly
  // lets you organize them into sections and have unlisted pages.
  pages: [
    { name: 'Pàgina inicial', path: '/' },
    { name: 'Eina de decisions', path: 'eina.html' }
  ],

  // Content to add to the head of the page, e.g. for a favicon:
  // The script closes the mobile menu when a page link is followed (like the X does),
  // so the framework doesn't persist it as open and restore it on the next page.
  head: `<link rel="icon" href="observable.png" type="image/png" sizes="32x32">
<script>
addEventListener("click", (event) => {
  const toggle = document.querySelector("#observablehq-sidebar-toggle");
  if (toggle?.checked && matchMedia("(max-width: 600px)").matches && event.target.closest?.("#observablehq-sidebar a[href]")) toggle.click();
});
</script>`,

  // The path to the source root.
  root: 'src',

  // Some additional configuration options and their defaults:
  theme: 'default', // try "light", "dark", "slate", etc.
  // Mobile-only top bar that opens the sidebar (styled in mobile-nav.css).
  // Pages without a sidebar (e.g. index) get no header.
  header: ({ data }) =>
    data.sidebar === false
      ? null
      : `<label for="observablehq-sidebar-toggle" class="mobile-nav-bar">
  <span>Certificats Energètics de Catalunya</span>
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>
</label>`,
  // footer: "Built with Observable.", // what to show in the footer (HTML)
  sidebar: true, // whether to show the sidebar
  // toc: true, // whether to show the table of contents
  // pager: true, // whether to show previous & next links in the footer
  // output: "dist", // path to the output root for build
  // search: true, // activate search
  // linkify: true, // convert URLs in Markdown to links
  // typographer: false, // smart quotes and other typographic improvements
  // preserveIndex: false, // drop /index from URLs
  cleanUrls: false,
  preserveExtension: true
};
