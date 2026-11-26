"""Freeze every displayed glyph into a local, offline WOFF2."""
from pathlib import Path
from html.parser import HTMLParser
from fontTools import subset
from fontTools.ttLib import TTFont

root=Path(__file__).resolve().parent
class Texts(HTMLParser):
    def __init__(self):super().__init__();self.text=[];self.skip=False
    def handle_starttag(self,t,a):
        if t in ('script','style'):self.skip=True
    def handle_endtag(self,t):
        if t in ('script','style'):self.skip=False
    def handle_data(self,s):
        if not self.skip:self.text.append(s)
p=Texts()
for path in (root/'compositions').glob('*.html'):p.feed(path.read_text())
chars=set(''.join(p.text))|set(chr(c) for c in range(32,127))
font=TTFont(root/'../../assets/raw/NotoSerifSC-wght.ttf')
missing=[c for c in chars if not c.isspace() and ord(c) not in font.getBestCmap()]
assert not missing,f'Missing glyphs: {missing}'
options=subset.Options();options.flavor='woff2';options.layout_features=['*']
sub=subset.Subsetter(options=options);sub.populate(text=''.join(sorted(chars)));sub.subset(font)
font.flavor='woff2';font.save(root/'assets/fonts/card-help.woff2')
print(f'{len(chars)} glyphs verified; subset saved')
