import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User not found');
    }

    const productsFound = await this.productsRepository.findAllById(products);

    if (productsFound.length !== products.length) {
      throw new AppError('One or more products not found');
    }

    const productsOutOfStock = productsFound.filter(product => {
      const productFound = products.find(p => p.id === product.id);

      if (!productFound) return true;

      if (productFound.quantity < product.quantity) {
        return false;
      }

      return true;
    });

    if (productsOutOfStock.length) {
      throw new AppError('No quantities for one or more products this order');
    }

    await this.productsRepository.updateQuantity(products);

    const productsWithPrice = products.map(product => {
      const productFound = productsFound.find(p => p.id === product.id);

      return {
        product_id: product.id,
        quantity: product.quantity,
        price: productFound?.price ?? 0,
      };
    });

    const order = this.ordersRepository.create({
      customer,
      products: productsWithPrice,
    });

    return order;
  }
}

export default CreateOrderService;
