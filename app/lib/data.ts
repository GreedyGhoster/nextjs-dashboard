'use server';

import { sql } from '@vercel/postgres';
import { PrismaClient } from '@prisma/client';
import { CustomersTableType, User } from './definitions';
import { formatCurrency } from './utils';
import { unstable_noStore as noStore } from 'next/cache';
import { Status } from '@prisma/client';

const prisma = new PrismaClient();

export async function fetchRevenue() {
  noStore();

  try {
    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const data = await prisma.revenue.findMany();

    console.log('Data fetch completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();
  try {
    const data = await prisma.invoices.findMany({
      select: {
        id: true,
        amount: true,
        customer: {
          select: {
            name: true,
            image_url: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();
  try {
    // Получение количества счетов
    const numberOfInvoices = await prisma.invoices.count();

    // Получение количества клиентов
    const numberOfCustomers = await prisma.customer.count();

    // Получение сумм оплаченных и ожидающих оплаты счетов
    const invoiceStatusPaid = await prisma.invoices.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: Status.Paid,
      },
    });

    const invoiceStatusPending = await prisma.invoices.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: Status.Pending,
      },
    });

    const totalPaidInvoices = formatCurrency(
      invoiceStatusPaid._sum.amount ?? 0,
    );
    const totalPendingInvoices = formatCurrency(
      invoiceStatusPending._sum.amount ?? 0,
    );

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  noStore();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const filteredInvoices = await prisma.invoices.findMany({
      select: {
        id: true,
        amount: true,
        date: true,
        status: true,
        customer: {
          select: {
            name: true,
            email: true,
            image_url: true,
          },
        },
      },
      where: {
        OR: [
          { customer: { name: { contains: query, mode: 'insensitive' } } },
          { customer: { email: { contains: query, mode: 'insensitive' } } },
          { date: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: {
        date: 'desc',
      },
      take: ITEMS_PER_PAGE,
      skip: offset,
    });

    return filteredInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  noStore();
  try {
    const count = await prisma.invoices.count({
      where: {
        OR: [
          { customer: { name: { contains: query, mode: 'insensitive' } } },
          { customer: { email: { contains: query, mode: 'insensitive' } } },
          { date: { contains: query, mode: 'insensitive' } },
        ],
      },
    });

    const totalPages = Math.ceil(Number(count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  noStore();
  try {
    const invoice = await prisma.invoices.findFirst({
      where: {
        id: id,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const amountInDollars = invoice.amount / 100;

    return { ...invoice, amount: amountInDollars };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  noStore();
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

// TODO customers
export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function getUser(email: string) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    return user as User;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
