# _dao_env.psd1 - WAM dao environment - default soft config (git-tracked)
#
# 道法自然 · 唯变所适 · 适配万法之电脑万法之用户
# 水无常形 · 利万物而有静 · 此为默认骨 · 不绑特定主机/用户
#
# 三层配置 (后者覆盖前者):
#   1. _dao_env.psd1           本文件 · git 跟踪 · 通用默认
#   2. _dao_env.local.psd1     本地覆盖 · gitignored · 此机此人专
#   3. WAM_TARGETS_JSON env    临时 override (JSON array)
#
# 远程目标加配 -> 编辑 _dao_env.local.psd1 (示例:)
#   @{
#       targets = @(
#           @{ name = 'local'; kind = 'local' }
#           @{ name = 'peer';  kind = 'smb'; host = '<ip>'; user = '<user>'; drive = 'C' }
#       )
#   }
#
# kind:
#   local   = $env:USERPROFILE on this machine
#   smb     = \\<host>\<drive>$\Users\<user>  (Windows admin share)
#   ssh     = ssh <user>@<host>  (reserved for future remote-exec mode)

@{
    extensionId = 'devaid.rt-flow'
    wamHomeDir  = '.wam'
    extDirHint  = '.windsurf\extensions'

    # 默认仅本机 · 任何 clone 即可工作 · 万人通用
    targets = @(
        @{ name = 'local'; kind = 'local' }
    )
}
