import importlib.util
from pathlib import Path
import sqlite3,tempfile,unittest
spec=importlib.util.spec_from_file_location('token_state',Path(__file__).resolve().parents[1]/'runtime/state.py')
state=importlib.util.module_from_spec(spec);spec.loader.exec_module(state)

class TokenPaceTests(unittest.TestCase):
 def tracker(self):
  self.assertTrue(hasattr(state,'TokenPaceTracker'),'Token-based sand pace is missing')
  return state.TokenPaceTracker()
 def row(self,tokens,thread='a',model='model-a'):
  return {'threadId':thread,'model':model,'totalTokens':tokens}
 def test_existing_lifetime_tokens_are_baseline_not_new_spend(self):
  tracker=self.tracker()
  self.assertEqual(tracker.observe([self.row(1000000)],0),0)
  self.assertEqual(tracker.observe([self.row(1000000)],10),0)
  self.assertEqual(tracker.observe([self.row(1001000)],20),50)
 def test_coefficients_weight_per_model_then_sum_concurrent_rates(self):
  tracker=self.tracker();weights={'defaultCoefficient':1,'models':{'model-b':2}}
  rows=[self.row(5000),self.row(8000,'b','model-b')]
  tracker.observe(rows,0,weights)
  rows=[self.row(5200),self.row(8100,'b','model-b')]
  self.assertEqual(tracker.observe(rows,10,weights),40)
 def test_batch_updates_use_elapsed_since_counter_change_not_two_second_poll(self):
  tracker=self.tracker();tracker.observe([self.row(5000)],0)
  tracker.observe([self.row(5000)],28)
  self.assertEqual(tracker.observe([self.row(8000)],30),100)
  self.assertAlmostEqual(tracker.observe([self.row(8000)],40),200/3)
  self.assertEqual(tracker.observe([self.row(8000)],60),0)
 def test_low_priced_model_coefficient_is_not_replaced_with_default(self):
  tracker=self.tracker();weights={'defaultCoefficient':1,'models':{'gpt-6-luna':.05}}
  tracker.observe([self.row(1000,model='gpt-6-luna')],0,weights)
  self.assertAlmostEqual(tracker.observe([self.row(1200,model='gpt-6-luna')],10,weights),1)
 def test_new_resumed_threads_model_changes_and_counter_rollbacks_rebase(self):
  tracker=self.tracker();tracker.observe([self.row(1000)],0)
  self.assertEqual(tracker.observe([self.row(1200)],10),20)
  self.assertEqual(tracker.observe([self.row(50)],12),0)
  self.assertEqual(tracker.observe([self.row(100000,'b')],14),0)
  self.assertEqual(tracker.observe([self.row(100100,'b','model-b')],16),0)
  self.assertEqual(tracker.observe([],18),0)
  self.assertEqual(tracker.observe([self.row(100200,'b','model-b')],20),0)
 def test_unavailable_data_and_long_gaps_never_reuse_old_rate(self):
  tracker=self.tracker();tracker.observe([self.row(1000)],0)
  self.assertEqual(tracker.observe([self.row(1200)],10),20)
  self.assertIsNone(tracker.observe(None,12))
  self.assertEqual(tracker.observe([self.row(2000)],14),0)
  self.assertEqual(tracker.observe([self.row(3000)],100),0)
 def test_coefficient_changes_apply_only_to_future_measured_tokens(self):
  tracker=self.tracker();tracker.observe([self.row(1000)],0)
  self.assertEqual(tracker.observe([self.row(1200)],10),20)
  weights={'defaultCoefficient':2,'models':{}}
  self.assertEqual(tracker.observe([self.row(1200)],12,weights),0)
  self.assertEqual(tracker.observe([self.row(1300)],22,weights),20)
 def test_database_reader_selects_only_requested_token_and_model_metadata(self):
  self.assertTrue(hasattr(state,'read_token_counters'),'Token metadata reader is missing')
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'state.sqlite'
   with sqlite3.connect(p) as c:
    c.execute('create table threads(id text,model text,tokens_used integer,first_user_message text)')
    c.executemany('insert into threads values(?,?,?,?)',[('a','model-a',1000,'private'),('b','model-b',9000,'private')])
   self.assertEqual(state.read_token_counters(p,['a']),[self.row(1000)])
   self.assertEqual(state.read_token_counters(p,[]),[])
   self.assertIsNone(state.read_token_counters(p,['a','missing']), 'Incomplete counters remain unknown')
   self.assertIsNone(state.read_token_counters(Path(d)/'missing.sqlite',['a']))

if __name__=='__main__':unittest.main()
