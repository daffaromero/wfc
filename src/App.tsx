import { createBrowserRouter, RouterProvider } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { LandingPage } from "./pages/LandingPage";
import { BrowsePage } from "./pages/BrowsePage";
import { PlaceDetailPage } from "./pages/PlaceDetailPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    element: <RootLayout />,
    children: [
      { path: "/browse", element: <BrowsePage /> },
      { path: "/place/:id", element: <PlaceDetailPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
