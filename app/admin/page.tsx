import { redirect } from 'next/navigation';

// The admin panel now lives at the home page. Keep /admin working for old links.
export default function AdminRedirect() {
  redirect('/');
}
