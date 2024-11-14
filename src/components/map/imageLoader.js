export class ImageLoader {
  constructor() {
    this.images = {
      empty: null,
      ton: null,
      lock: null,
      user: null,
      tree: null,
    };
    this.loadedCount = 0;
  }

  async loadImages(imagePaths) {
    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
      });
    };

    const [emptyImg, tonImg, lockImg, userImg, treeImg] = await Promise.all([
      loadImage(imagePaths.empty),
      loadImage(imagePaths.ton),
      loadImage(imagePaths.lock),
      loadImage(imagePaths.user),
      loadImage(imagePaths.tree),
    ]);

    this.images.empty = emptyImg;
    this.images.ton = tonImg;
    this.images.lock = lockImg;
    this.images.user = userImg;
    this.images.tree = treeImg;
    this.loadedCount = 5;
  }

  getPointImage(type) {
    switch (type) {
      case "user":
        return this.images.user;
      case "mine":
        return this.images.ton;
      case "lock":
        return this.images.lock;
      case "tree":
        return this.images.tree;
      default:
        return this.images.empty;
    }
  }

  isLoaded() {
    return this.loadedCount === 5;
  }
}
