'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const MapCartContext = createContext(null);

export function MapCartProvider({ children }) {
  const [selectedProducts, setSelectedProducts] = useState([]);

  const normalizeBagProduct = useCallback((product) => {
    if (!product?.id) return null;
    const storeName = product.storeName || product.storeLabel || 'Loja';
    const lat = Number(product?.storeGeo?.lat ?? product?.storeLat ?? product?.lat);
    const lng = Number(product?.storeGeo?.lng ?? product?.storeLng ?? product?.lng);
    const parsedPrice =
      typeof product?.priceNum === 'number'
        ? product.priceNum
        : typeof product?.price === 'number'
          ? product.price
          : null;
    return {
      ...product,
      id: String(product.id),
      offerId: String(product.offerId || product.id),
      name: product.name || product.productName || '',
      productName: product.productName || product.name || '',
      storeName,
      storeLabel: product.storeLabel || storeName,
      price: parsedPrice,
      priceNum: parsedPrice,
      placeId: product.placeId || product.storePlaceId || null,
      storeGeo:
        Number.isFinite(lat) && Number.isFinite(lng)
          ? { lat, lng }
          : product.storeGeo && Number.isFinite(Number(product.storeGeo.lat)) && Number.isFinite(Number(product.storeGeo.lng))
            ? { lat: Number(product.storeGeo.lat), lng: Number(product.storeGeo.lng) }
            : null,
    };
  }, []);

  const addSelectedProduct = useCallback((product) => {
    const normalized = normalizeBagProduct(product);
    if (!normalized) return;
    setSelectedProducts((prev) => {
      if (prev.some((p) => p.id === normalized.id)) return prev;
      return prev.concat(normalized);
    });
  }, [normalizeBagProduct]);

  const removeSelectedProduct = useCallback((productId) => {
    const id = String(productId || '');
    if (!id) return;
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleSelectedProduct = useCallback((product) => {
    const normalized = normalizeBagProduct(product);
    if (!normalized) return;
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.id === normalized.id);
      if (exists) return prev.filter((p) => p.id !== normalized.id);
      return prev.concat(normalized);
    });
  }, [normalizeBagProduct]);

  const clearSelectedProducts = useCallback(() => {
    setSelectedProducts([]);
  }, []);

  const value = useMemo(
    () => ({
      shoppingBag: selectedProducts,
      selectedProducts,
      setSelectedProducts,
      addSelectedProduct,
      removeSelectedProduct,
      toggleSelectedProduct,
      clearSelectedProducts,
      shoppingBagTotals: {
        itemsCount: selectedProducts.length,
        totalPrice: selectedProducts.reduce(
          (acc, item) => acc + (typeof item?.priceNum === 'number' ? item.priceNum : 0),
          0
        ),
      },
      groupedByStore: selectedProducts.reduce((acc, item) => {
        const key = String(item.storeName || item.storeLabel || 'Loja');
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {}),
    }),
    [
      selectedProducts,
      addSelectedProduct,
      removeSelectedProduct,
      toggleSelectedProduct,
      clearSelectedProducts,
    ]
  );

  return <MapCartContext.Provider value={value}>{children}</MapCartContext.Provider>;
}

export function useMapCart() {
  const ctx = useContext(MapCartContext);
  if (!ctx) {
    throw new Error('useMapCart must be used inside MapCartProvider');
  }
  return ctx;
}
