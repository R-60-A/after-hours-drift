"""Package only the playable game for GitHub Pages; Python standard library only."""

from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"


class AssetReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "img") and attrs.get("src"):
            self.paths.append(attrs["src"])
        if tag == "link" and attrs.get("href"):
            self.paths.append(attrs["href"])


def check_asset(reference):
    """Catch root-relative paths and case mismatches before Linux deployment."""
    url = urlsplit(reference)
    if url.scheme or url.netloc or reference.startswith("/"):
        raise ValueError(f"Game assets must use project-relative paths: {reference}")
    path = unquote(url.path)
    asset = (OUTPUT / path).resolve()
    if not asset.is_relative_to(OUTPUT.resolve()) or not asset.is_file():
        raise ValueError(f"Missing or out-of-site asset: {reference}")
    parent = OUTPUT
    for component in Path(path).parts:
        if component not in {child.name for child in parent.iterdir()}:
            raise ValueError(f"Asset name has incorrect case: {reference}")
        parent /= component


def build():
    # This fixed, checked target is generated output, never the source tree.
    if OUTPUT.is_symlink() or OUTPUT.resolve() != ROOT / "_site":
        raise ValueError("Refusing to replace an unexpected output directory")
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    shutil.copy2(ROOT / "index.html", OUTPUT / "index.html")
    for folder in ("src", "styles", "assets/images"):
        shutil.copytree(ROOT / folder, OUTPUT / folder)
    (OUTPUT / ".nojekyll").touch()

    parser = AssetReferences()
    parser.feed((OUTPUT / "index.html").read_text(encoding="utf-8"))
    references = parser.paths
    # Images are loaded through ordinary Image objects in the game bootstrap.
    game = (OUTPUT / "src/game.js").read_text(encoding="utf-8")
    references += re.findall(r"['\"](assets/[^'\"]+)['\"]", game)
    for reference in references:
        check_asset(reference)
    files = [path for path in OUTPUT.rglob("*") if path.is_file()]
    print(f"Prepared {len(files)} game files; validated {len(references)} asset references.")
    print("Only index.html, src, styles, and runtime images are published.")


if __name__ == "__main__":
    build()
