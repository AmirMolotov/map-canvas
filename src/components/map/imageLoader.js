export class ImageLoader {
  constructor() {
    this.images = {
      empty: null,
      ton: null,
      lock: null,
      user: null,
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

    const [emptyImg, tonImg, lockImg, userImg] = await Promise.all([
      loadImage(imagePaths.empty),
      loadImage(imagePaths.ton),
      loadImage(imagePaths.lock),
      loadImage(imagePaths.user),
    ]);

    this.images.empty = emptyImg;
    this.images.ton = tonImg;
    this.images.lock = lockImg;
    this.images.user = userImg;
    this.loadedCount = 4;
  }

  getPointImage(type) {
    switch (type) {
      case "user":
        return this.images.user;
      case "mine":
        return this.images.ton;
      case "lock":
        return this.images.lock;
      default:
        return this.images.empty;
    }
  }

  isLoaded() {
    return this.loadedCount === 4;
  }
}
