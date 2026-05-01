import { createBrowserRouter, RouterProvider } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { BrowsePage } from "./pages/BrowsePage";
import { PlaceDetailPage } from "./pages/PlaceDetailPage";

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <BrowsePage /> },
      { path: "/place/:id", element: <PlaceDetailPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
