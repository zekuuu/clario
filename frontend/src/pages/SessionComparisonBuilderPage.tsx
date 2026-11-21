import { useNavigate } from "react-router-dom";
import { useEnsureFileSources } from "../features/files/useEnsureFileSources";
import { ComparisonBuilderPage } from "./ComparisonBuilderPage";

export function SessionComparisonBuilderPage() {
  const navigate = useNavigate();
  useEnsureFileSources();

  return <ComparisonBuilderPage onBackToRowSetup={() => navigate("/mapping")} />;
}
