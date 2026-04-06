import './globals.css';

export const metadata = {
  title: 'MoneyGuy 2.0 Next Eval',
  description: 'Parallel Next.js evaluation app using existing MoneyGuy workflows with Stitch design language.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
