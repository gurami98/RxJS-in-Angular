import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import {BehaviorSubject, combineLatest, from, merge, Observable, Subject, throwError} from 'rxjs';
import {catchError, filter, map, mergeMap, scan, shareReplay, switchMap, tap, toArray} from 'rxjs/operators';

import { Product } from './product';
import { Supplier } from '../suppliers/supplier';
import { SupplierService } from '../suppliers/supplier.service';
import {ProductCategory} from '../product-categories/product-category';
import {ProductCategoryService} from '../product-categories/product-category.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  constructor(private http: HttpClient,
              private supplierService: SupplierService,
              private productCategoryService: ProductCategoryService) { }
  private productsUrl = 'api/products';
  private suppliersUrl = this.supplierService.suppliersUrl;

  private productSelectedSubject = new BehaviorSubject<number>(0);
  productSelectedAction$ = this.productSelectedSubject.asObservable();

  private productInsertedSubject = new Subject<Product>();
  productInsertedAction$ = this.productInsertedSubject.asObservable();

  products$ = this.http.get<Product[]>(this.productsUrl)
    .pipe(
      tap(data => console.log('Products', data)),
      catchError(this.handleError)
    );

  productsWithCategories$ = combineLatest([
    this.products$,
    this.productCategoryService.productCategories$
  ])
    .pipe(
      map(([products, categories]) =>
        products.map(product => ({
          ...product,
          price: product.price * 1.5,
          category: categories.find(c => product.categoryId === c.id).name,
          searchKey: [product.productName]
        }) as Product)
      ),
      shareReplay(1),
      catchError(this.handleError)
    );

  productsWithAdd$ = merge(
    this.productsWithCategories$,
    this.productInsertedAction$
  ).pipe(
    scan((acc: Product[], value: Product) => [...acc, value])
  );

  selectedProduct$ = combineLatest([
    this.productsWithCategories$,
    this.productSelectedAction$
  ]).pipe(
      map(([products, selectedCategoryId]) =>
        products.find(product => product.id === selectedCategoryId)
      ),
      tap(product => console.log('selected product', product)),
      shareReplay(1),
  );

  selectedProductSuppliers$ = this.selectedProduct$
    .pipe(
      filter(selectedProduct => Boolean(selectedProduct)),
      switchMap(selectedProduct =>
        from(selectedProduct.supplierIds)
          .pipe(
            mergeMap(supplierId => this.http.get<Supplier>(`${this.suppliersUrl}/${supplierId}`)),
            toArray(),
            tap(suppliers => console.log('product suppliers', JSON.stringify(suppliers)))
          )
      )
    );


  // selectedProductSuppliers$ = combineLatest([
  //   this.selectedProduct$,
  //   this.supplierService.suppliers$
  // ]).pipe(
  //   map(([selectedProduct, suppliers]) =>
  //   suppliers.filter(supplier => selectedProduct.supplierIds.includes(supplier.id)))
  // );

  addProduct(newProduct?: Product): void{
    newProduct = newProduct || this.fakeProduct();
    this.productInsertedSubject.next(newProduct);
  }

  selectedProductChanged(selectedProductId: number): void {
    this.productSelectedSubject.next(selectedProductId);
  }

  private fakeProduct(): Product {
    return {
      id: 42,
      productName: 'Another One',
      productCode: 'TBX-0042',
      description: 'Our new product',
      price: 8.9,
      categoryId: 3,
      category: 'Toolbox',
      quantityInStock: 30
    };
  }

  private handleError(err: any): Observable<never> {
    // in a real world app, we may send the server to some remote logging infrastructure
    // instead of just logging it to the console
    let errorMessage: string;
    if (err.error instanceof ErrorEvent) {
      // A client-side or network error occurred. Handle it accordingly.
      errorMessage = `An error occurred: ${err.error.message}`;
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong,
      errorMessage = `Backend returned code ${err.status}: ${err.body.error}`;
    }
    console.error(err);
    return throwError(errorMessage);
  }

}
