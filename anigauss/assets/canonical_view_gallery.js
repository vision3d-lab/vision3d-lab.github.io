(() => {
  const slides = ['demo0000.jpg', 'demo0001.jpg', 'demo0002.jpg', 'demo0003.jpg', 'demo0004.jpg', 'demo0005.jpg', 'demo0006.jpg', 'demo0007.jpg', 'demo0008.jpg', 'demo0009.jpg', 'demo0010.jpg', 'demo0011.jpg', 'demo0012.jpg', 'demo0013.jpg', 'demo0014.jpg', 'demo0015.jpg', 'demo0016.jpg', 'demo0017.jpg', 'demo0018.jpg', 'demo0019.jpg', 'demo0020.jpg', 'demo0021.jpg', 'demo0022.jpg', 'demo0023.jpg', 'demo0024.jpg', 'demo0025.jpg', 'demo0026.jpg', 'demo0027.jpg', 'demo0028.jpg', 'demo0029.jpg', 'demo0030.jpg', 'demo0031.jpg', 'demo0032.jpg', 'demo0033.jpg', 'demo0034.jpg', 'demo0035.jpg', 'demo0036.jpg', 'demo0037.jpg', 'demo0038.jpg', 'demo0039.jpg', 'demo0040.jpg', 'demo0041.jpg', 'demo0042.jpg', 'demo0043.jpg', 'demo0044.jpg', 'demo0045.jpg', 'demo0046.jpg', 'demo0047.jpg', 'demo0048.jpg', 'demo0049.jpg', 'demo0050.jpg', 'demo0051.jpg', 'demo0052.jpg', 'demo0053.jpg', 'demo0054.jpg', 'demo0055.jpg', 'demo0056.jpg', 'demo0057.jpg', 'demo0058.jpg', 'demo0059.jpg', 'demo0060.jpg', 'demo0061.jpg', 'demo0062.jpg', 'demo0063.jpg', 'demo0064.jpg', 'demo0065.jpg', 'demo0066.jpg', 'demo0067.jpg', 'demo0068.jpg', 'demo0069.jpg', 'demo0070.jpg', 'demo0071.jpg', 'demo0072.jpg', 'demo0073.jpg', 'demo0074.jpg', 'demo0075.jpg', 'demo0076.jpg', 'demo0077.jpg', 'demo0078.jpg', 'demo0079.jpg', 'demo0080.jpg', 'demo0081.jpg', 'demo0082.jpg', 'demo0083.jpg', 'demo0084.jpg', 'demo0085.jpg', 'demo0086.jpg', 'demo0087.jpg', 'demo0088.jpg', 'demo0089.jpg', 'demo0090.jpg', 'demo0091.jpg', 'demo0092.jpg', 'demo0093.jpg', 'demo0094.jpg', 'demo0095.jpg', 'demo0096.jpg', 'demo0097.jpg', 'demo0098.jpg', 'demo0099.jpg', 'demo0100.jpg', 'demo0101.jpg', 'demo0102.jpg', 'demo0103.jpg', 'demo0104.jpg', 'demo0105.jpg', 'demo0106.jpg', 'demo0107.jpg', 'demo0108.jpg', 'demo0109.jpg', 'demo0110.jpg', 'demo0111.jpg', 'demo0112.jpg', 'demo0113.jpg', 'demo0114.jpg', 'demo0115.jpg', 'demo0116.jpg', 'demo0117.jpg', 'demo0118.jpg', 'demo0119.jpg', 'demo0120.jpg', 'demo0121.jpg', 'demo0122.jpg', 'demo0123.jpg', 'demo0124.jpg', 'demo0125.jpg', 'demo0126.jpg', 'demo0127.jpg', 'demo0128.jpg', 'demo0129.jpg', 'demo0130.jpg', 'demo0131.jpg', 'demo0132.jpg', 'demo0133.jpg', 'demo0134.jpg', 'demo0135.jpg', 'demo0136.jpg', 'demo0137.jpg', 'demo0138.jpg', 'demo0139.jpg', 'demo0140.jpg', 'demo0141.jpg', 'demo0142.jpg', 'demo0143.jpg', 'demo0144.jpg', 'demo0145.jpg', 'demo0146.jpg', 'demo0147.jpg', 'demo0148.jpg', 'demo0149.jpg', 'demo0150.jpg', 'demo0151.jpg', 'demo0152.jpg', 'demo0153.jpg', 'demo0154.jpg', 'demo0155.jpg', 'demo0156.jpg', 'demo0157.jpg', 'demo0158.jpg', 'demo0159.jpg', 'demo0160.jpg', 'demo0161.jpg', 'demo0162.jpg', 'demo0163.jpg', 'demo0164.jpg', 'demo0165.jpg', 'demo0166.jpg', 'demo0167.jpg', 'demo0168.jpg', 'demo0169.jpg', 'demo0170.jpg', 'demo0171.jpg', 'demo0172.jpg', 'demo0173.jpg', 'demo0174.jpg', 'demo0175.jpg', 'demo0176.jpg', 'demo0177.jpg', 'demo0178.jpg', 'demo0179.jpg', 'demo0180.jpg', 'demo0181.jpg', 'demo0182.jpg', 'demo0183.jpg', 'demo0184.jpg', 'demo0185.jpg', 'demo0186.jpg', 'demo0187.jpg', 'demo0188.jpg', 'demo0189.jpg', 'demo0190.jpg', 'demo0191.jpg', 'demo0192.jpg', 'demo0193.jpg', 'demo0194.jpg', 'demo0195.jpg', 'demo0196.jpg', 'demo0197.jpg', 'demo0198.jpg', 'demo0199.jpg', 'demo0200.jpg'];
  const base = 'assets/canonical_view_generator_gallery/';
  const img = document.getElementById('cvg-slide');
  const counter = document.getElementById('cvg-counter');
  const range = document.getElementById('cvg-range');
  const prev = document.getElementById('cvg-prev');
  const next = document.getElementById('cvg-next');
  const random = document.getElementById('cvg-random');
  if (!img || !counter || !range || !prev || !next) return;

  let index = 0;
  range.max = String(slides.length - 1);

  function preload(i) {
    if (i < 0 || i >= slides.length) return;
    const pre = new Image();
    pre.src = base + slides[i];
  }

  function show(i) {
    index = (i + slides.length) % slides.length;
    const filename = slides[index];
    img.src = base + filename;
    img.alt = `Canonical View Generator example ${index + 1}: input image and generated front, left, back, and right views`;
    counter.textContent = `${index + 1} / ${slides.length}`;
    range.value = String(index);
    preload((index + 1) % slides.length);
    preload((index - 1 + slides.length) % slides.length);
  }

  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  range.addEventListener('input', (event) => show(Number(event.target.value)));
  if (random) random.addEventListener('click', () => show(Math.floor(Math.random() * slides.length)));

  document.addEventListener('keydown', (event) => {
    const gallery = document.getElementById('canonical-view-generator');
    if (!gallery) return;
    const rect = gallery.getBoundingClientRect();
    const visible = rect.top < window.innerHeight && rect.bottom > 0;
    if (!visible) return;
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });

  show(0);
})();
