'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const MapCartContext = createContext(null);

export function MapCartProvider({ children }) {
  const [selectedProducts, setSelectedProducts] = useState([]);

  const addSelectedProduct = useCallback((product) => {
    if (!product?.id) return;
    setSelectedProducts((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      return prev.concat(product);
    });
  }, []);

  const removeSelectedProduct = useCallback((productId) => {
    const id = String(productId || '');
    if (!id) return;
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleSelectedProduct = useCallback((product) => {
    if (!product?.id) return;
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      return prev.concat(product);
    });
  }, []);

  const clearSelectedProducts = useCallback(() => {
    setSelectedProducts([]);
  }, []);

  const value = useMemo(
    () => ({
      selectedProducts,
      setSelectedProducts,
      addSelectedProduct,
      removeSelectedProduct,
      toggleSelectedProduct,
      clearSelectedProducts,
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
