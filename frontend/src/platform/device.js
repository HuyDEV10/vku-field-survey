import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';
export const native = Capacitor.isNativePlatform();
export async function capturePhoto() {
  const result = await Camera.getPhoto({
    quality: 75,
    width: 1400,
    height: 1400,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    saveToGallery: false,
  });
  return await (await fetch(result.webPath)).blob();
}
export async function listenNetwork(callback) {
  if (native) {
    callback((await Network.getStatus()).connected);
    await Network.addListener('networkStatusChange', (s) => callback(s.connected));
    await App.addListener('appStateChange', async (s) => {
      if (s.isActive) callback((await Network.getStatus()).connected);
    });
    await App.addListener('appRestoredResult', async (result) => {
      if (result.pluginId === 'Camera' && result.success && result.data?.webPath) {
        const photo = await (await fetch(result.data.webPath)).blob();
        window.dispatchEvent(new CustomEvent('restored-photo', { detail: photo }));
      }
    });
  } else {
    callback(navigator.onLine);
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  }
}
export async function compressPhoto(blob) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type))
    throw new Error('Chọn ảnh JPEG, PNG hoặc WebP.');
  if (blob.size > 20 * 1024 * 1024) throw new Error('Ảnh gốc tối đa 20 MB.');
  const bitmap = await createImageBitmap(blob),
    scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const output = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  if (!output || output.size > 4 * 1024 * 1024) throw new Error('Ảnh sau nén phải nhỏ hơn 4 MB.');
  return output;
}
