import { Suspense } from 'react';
import ProductPage from '@/components/product/ProductPage';

export default function ProductRoute() {
  return (
    <Suspense fallback={null}>
      <ProductPage />
    </Suspense>
  );
}
