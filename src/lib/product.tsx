import { createContext, useContext, useState, type ReactNode } from "react";

export type Product = "insurance" | "loan";

const ProductContext = createContext<{
  product: Product;
  setProduct: (p: Product) => void;
}>({ product: "insurance", setProduct: () => {} });

export function ProductProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<Product>("insurance");
  return (
    <ProductContext.Provider value={{ product, setProduct }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  return useContext(ProductContext);
}
