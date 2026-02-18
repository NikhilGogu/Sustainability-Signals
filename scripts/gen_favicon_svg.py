import base64, os

pub = os.path.join(os.path.dirname(__file__), '..', 'public')
with open(os.path.join(pub, 'favicon-32x32.png'), 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()

href = 'data:image/png;base64,' + b64
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" '
    'xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32">\n'
    '  <image width="32" height="32" xlink:href="' + href + '"/>\n'
    '</svg>\n'
)

out = os.path.join(pub, 'favicon.svg')
with open(out, 'w') as f:
    f.write(svg)
print('favicon.svg written')
