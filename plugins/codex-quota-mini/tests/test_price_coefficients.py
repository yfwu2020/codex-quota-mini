import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('price_coefficients',Path(__file__).resolve().parents[1]/'scripts/price_coefficients.py')

class PriceCoefficientsTests(unittest.TestCase):
 def test_official_price_ratios_use_one_baseline_and_preserve_small_weights(self):
  self.assertTrue(Path(spec.origin).exists(),'Price coefficient calculator is missing')
  module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  settings=module.calculate()
  self.assertEqual(settings['defaultCoefficient'],1)
  for model,expected in {'gpt-6.1-sol':1,'gpt-6-sol':1,'gpt-6-astra':5,'gpt-6-luna':.05,'gpt-5.6-sol':2,'gpt-5.6-terra':7/6,'gpt-5.6-luna':7/60,'gpt-5.5':35/12,'gpt-5.4':35/24,'gpt-5.4-mini':.4375,'gpt-5.3-codex':1.3125}.items():
   self.assertAlmostEqual(settings['models'][model],expected)
  self.assertNotIn('codex-auto-review',settings['models'])
  self.assertNotIn('gpt-reserve',settings['models'])
if __name__=='__main__':unittest.main()
