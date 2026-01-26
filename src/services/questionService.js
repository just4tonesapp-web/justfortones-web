import { supabase } from '../supabaseClient'

export const QuestionService = {
  // 获取 Step 2 (发音测试) 的题目
  async getSpeakingTest() {
    // 这里假设我们在数据库里把测试题标记为 'step2'
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('test_stage', 'step2') 
      .limit(1) // MVP 先只拿 1 个词测测看

    if (error) {
      console.error('Error fetching questions:', error)
      return []
    }
    return data
  }
}