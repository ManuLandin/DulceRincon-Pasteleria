"""Descarga recursos públicos de presentación; no requiere dependencias Python."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
import re

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
FILES = {
    'vendor/bootstrap/bootstrap.min.css': 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css',
    'vendor/bootstrap/bootstrap.bundle.min.js': 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js',
    'vendor/tabler/tabler-icons.min.css': 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css',
    'vendor/tabler/fonts/tabler-icons.woff2': 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/fonts/tabler-icons.woff2',
    'images/hero-cake.jpg': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1400&q=90',
    'images/pink-cake.jpg': 'https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&w=900&q=85',
    'images/cupcakes.jpg': 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=900&q=85',
    'images/cookies.jpg': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=900&q=85',
    'images/pastry.jpg': 'https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?auto=format&fit=crop&w=900&q=85',
    'images/berry-dessert.jpg': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85',
    'images/bakery.jpg': 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1000&q=85',
}
HEADERS = {'User-Agent': 'Mozilla/5.0'}

def download(item):
    rel, url = item
    target = ASSETS / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size > 100:
        return f'Exists: {rel}'
    with urlopen(Request(url, headers=HEADERS), timeout=45) as response:
        content = response.read()
    target.write_bytes(content)
    return f'Saved: {rel} ({len(content)} bytes)'

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=5) as pool:
        for result in pool.map(download, FILES.items()):
            print(result)
    families = {
        'dm-sans': 'DM+Sans:wght@400;500;600;700',
        'cormorant': 'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500;1,600',
    }
    font_css = []
    for name, family in families.items():
        url = f'https://fonts.googleapis.com/css2?family={family}&display=swap'
        request = Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'})
        css = urlopen(request, timeout=30).read().decode()
        # Conservar latin y latin-ext; ambos incluyen el texto en español.
        blocks = re.findall(r'/\* (latin(?:-ext)?) \*/\s*(@font-face\s*\{[^}]+\})', css)
        for index, (_, block) in enumerate(blocks):
            source = re.search(r'url\((https://[^)]+)\)', block).group(1)
            filename = f'{name}-{index}.woff2'
            download((f'vendor/fonts/{filename}', source))
            font_css.append(block.replace(source, filename))
    (ASSETS / 'vendor/fonts/fonts.css').write_text('\n'.join(font_css), encoding='utf-8')
    print(f'Prepared {len(font_css)} font faces.')
