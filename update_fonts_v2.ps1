$files = Get-ChildItem -Path "frontend\src" -Filter "*.jsx" -Recurse

$map = @{
    'text-2xl' = 'text-3xl'
    'text-xl'  = 'text-2xl'
    'text-lg'  = 'text-xl'
    'text-base' = 'text-lg'
    'text-sm'   = 'text-base'
    'text-xs'   = 'text-sm'
    'text-[6px]' = 'text-[9px]'
    'text-[7px]' = 'text-[10px]'
    'text-[8px]' = 'text-[11px]'
    'text-[9px]' = 'text-[12px]'
    'text-[10px]' = 'text-[13px]'
    'text-[11px]' = 'text-[14px]'
    'text-[12px]' = 'text-[15px]'
    'text-[13px]' = 'text-[16px]'
    'text-[14px]' = 'text-[17px]'
}

# Regex to match any of the keys
# For utility classes, use word boundary. For bracketed, match exactly.
$pattern = 'text-(2xl|xl|lg|base|sm|xs)\b|text-\[(\d+)px\]'

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $originalContent = $content

    $content = [regex]::Replace($content, $pattern, {
        param($m)
        $matchStr = $m.Value
        
        # Check if it's a utility class
        if ($map.ContainsKey($matchStr)) {
            return $map[$matchStr]
        }
        
        # Check if it's a bracketed px value
        if ($matchStr -like 'text-[*px]') {
            $val = [int]$m.Groups[2].Value
            if ($val -le 14) {
                $newVal = $val + 3
                return "text-[" + $newVal + "px]"
            }
        }
        
        return $matchStr
    })

    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated $($file.FullName)"
    }
}
