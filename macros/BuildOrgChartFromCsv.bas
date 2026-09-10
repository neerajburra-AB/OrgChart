Attribute VB_Name = "OrgPulseSmartArt"
'================================================================================
' BuildOrgChartFromCsv - generates REAL, native PowerPoint SmartArt Hierarchy
' diagrams automatically from an OrgPulse CSV export ("Download for SmartArt
' Macro (.csv)" in the app), one SmartArt diagram per new slide.
'
' WHY THIS EXISTS
' No external library (pptxgenjs, python-pptx, anything outside PowerPoint
' itself) can create a genuine SmartArt object - it's PowerPoint's own
' proprietary diagram engine with its own internal diagram-data XML. The only
' way to create a REAL SmartArt programmatically is from INSIDE PowerPoint,
' driving its Object Model - which is exactly what this macro does
' (Shapes.AddSmartArt + SmartArtNode.AddNode). This is the third and closest-
' to-the-original-ask option, after (1) native shapes styled to look like
' SmartArt [see exportPpt.js] and (2) a paste-able outline for ONE manually
' built SmartArt [see exportSmartArtOutline.js].
'
' WHY IT'S SAFE FROM SMARTART'S SIZE LIMITS
' The CSV is pre-grouped by OrgPulse into "one manager + up to 6 direct
' reports" chunks (the exact same buildCascadingSlideSpecs grouping the PPT
' export uses) BEFORE it ever reaches this macro. So every SmartArt diagram
' this macro creates has at most 7 nodes (1 header + up to 6 children) -
' always comfortably inside SmartArt's own readable range, however large the
' whole organization is. A big org just means more slides, never one
' overloaded diagram.
'
' HOW TO USE
'   1. In PowerPoint: Alt+F11 to open the VBA editor.
'   2. File > Import File... and choose this .bas file
'      (or paste its contents into a new Module).
'   3. Alt+F8, select BuildOrgChartFromCsv, click Run.
'   4. Pick the CSV file OrgPulse generated when prompted.
'   5. Wait - one slide + one SmartArt diagram is created per group. For a
'      large org this can take a while; PowerPoint's status bar / title bar
'      may look unresponsive, that's normal, don't close it.
'
' Tested designed against the Office VBA Object Model as documented by
' Microsoft; it has NOT been run against a live PowerPoint session (that is
' not possible from the environment this was written in). Please test it on
' a small CSV first (a single team/department) and report back anything that
' errors before relying on it for a full organization.
'================================================================================

Option Explicit

Sub BuildOrgChartFromCsv()

    Dim csvPath As Variant
    csvPath = Application.GetOpenFilename( _
        FileFilter:="CSV Files (*.csv), *.csv", _
        Title:="Select the OrgPulse SmartArt Macro Data CSV")

    If csvPath = False Then
        MsgBox "No file selected - cancelled.", vbInformation
        Exit Sub
    End If

    Dim hierarchyLayout As Object
    Set hierarchyLayout = FindHierarchyLayout()
    If hierarchyLayout Is Nothing Then
        MsgBox "Could not find a 'Hierarchy' SmartArt layout in this version of " & _
               "PowerPoint. Please open Insert > SmartArt once, confirm a Hierarchy " & _
               "layout is visible there, then try again.", vbCritical
        Exit Sub
    End If

    Dim fileNum As Integer
    fileNum = FreeFile
    Open csvPath For Input As #fileNum

    Dim rawLine As String
    Dim isHeaderRow As Boolean
    isHeaderRow = True

    ' Rows are pre-grouped by SlideTitle, one group after another, each group
    ' beginning with exactly one HEADER row followed by its CHILD rows - so we
    ' can build one group at a time as we scan, flushing whenever the
    ' SlideTitle column changes (or at end of file).
    Dim currentTitle As String
    Dim currentHeaderLabel As String
    Dim childLabels() As String
    Dim childCount As Long
    currentTitle = ""
    currentHeaderLabel = ""
    childCount = 0
    ReDim childLabels(0 To 999)

    Dim slidesCreated As Long
    slidesCreated = 0

    Do While Not EOF(fileNum)
        Line Input #fileNum, rawLine
        If isHeaderRow Then
            isHeaderRow = False
            ' Skip the "SlideTitle,Role,Label" header row itself.
            GoTo ContinueLoop
        End If
        If Trim(rawLine) = "" Then GoTo ContinueLoop

        Dim fields() As String
        fields = ParseCsvLine(rawLine)
        If UBound(fields) < 2 Then GoTo ContinueLoop ' malformed/short line - skip it

        Dim rowTitle As String, rowRole As String, rowLabel As String
        rowTitle = fields(0)
        rowRole = fields(1)
        rowLabel = fields(2)

        If rowTitle <> currentTitle And currentTitle <> "" Then
            ' Title changed - the previous group is complete, build its slide.
            AddHierarchySlide hierarchyLayout, currentTitle, currentHeaderLabel, childLabels, childCount
            slidesCreated = slidesCreated + 1
            childCount = 0
        End If

        currentTitle = rowTitle
        If rowRole = "HEADER" Then
            currentHeaderLabel = rowLabel
        Else
            childLabels(childCount) = rowLabel
            childCount = childCount + 1
        End If

ContinueLoop:
    Loop

    Close #fileNum

    ' Flush the final group (no more title changes left to trigger it).
    If currentTitle <> "" Then
        AddHierarchySlide hierarchyLayout, currentTitle, currentHeaderLabel, childLabels, childCount
        slidesCreated = slidesCreated + 1
    End If

    MsgBox "Done - created " & slidesCreated & " slide(s), each with its own " & _
           "native SmartArt Hierarchy diagram.", vbInformation

End Sub

' Creates one new slide with one SmartArt Hierarchy diagram: headerLabel as the
' root node, one child node per entry in childLabels(0 To childCount - 1).
Private Sub AddHierarchySlide(ByVal hierarchyLayout As Object, ByVal slideTitle As String, _
    ByVal headerLabel As String, ByRef childLabels() As String, ByVal childCount As Long)

    Dim newSlide As Object
    Set newSlide = ActivePresentation.Slides.Add( _
        ActivePresentation.Slides.Count + 1, ppLayoutTitleOnly)
    newSlide.Shapes.Title.TextFrame.TextRange.Text = slideTitle

    Dim saShape As Object
    Set saShape = newSlide.Shapes.AddSmartArt(hierarchyLayout, 40, 100, 860, 480)

    Dim smartArt As Object
    Set smartArt = saShape.SmartArt

    ' A freshly created SmartArt diagram can start with more than one default
    ' placeholder node depending on the layout/Office version - trim it down to
    ' exactly one node first so that remaining node can be safely treated as the
    ' single root, rather than assuming AllNodes.Count = 1 out of the box.
    Do While smartArt.AllNodes.Count > 1
        smartArt.AllNodes.Item(smartArt.AllNodes.Count).Delete
    Loop

    Dim rootNode As Object
    Set rootNode = smartArt.AllNodes.Item(1)
    rootNode.TextFrame2.TextRange.Text = headerLabel

    Dim i As Long
    For i = 0 To childCount - 1
        Dim newNode As Object
        Set newNode = rootNode.AddNode(msoSmartArtNodePositionAfterLastChild, msoSmartArtNodeTypeGeneral)
        newNode.TextFrame2.TextRange.Text = childLabels(i)
    Next i

End Sub

' Searches the installed SmartArt layouts by name rather than a hardcoded
' index/position, since the exact index of "Hierarchy" varies across Office
' versions and UI languages. Falls back to nothing found (caller handles it)
' rather than guessing a layout that might not be a hierarchy at all.
Private Function FindHierarchyLayout() As Object
    Dim layouts As Object
    Set layouts = Application.SmartArtLayouts

    Dim i As Long
    For i = 1 To layouts.Count
        If InStr(1, layouts(i).Name, "Hierarchy", vbTextCompare) > 0 Then
            Set FindHierarchyLayout = layouts(i)
            Exit Function
        End If
    Next i

    Set FindHierarchyLayout = Nothing
End Function

' Small hand-rolled quoted-field CSV line parser - no external dependency
' (vanilla VBA also has no built-in CSV parser, same reasoning as the CSV-not-
' JSON choice made in exportSmartArtMacroData.js). Handles double-quoted
' fields, commas inside quotes, and "" as an escaped quote - matching exactly
' what csvEscape() in that file produces.
Private Function ParseCsvLine(ByVal line As String) As String()
    Dim result() As String
    ReDim result(0 To 9)
    Dim resultCount As Long
    resultCount = 0

    Dim i As Long, n As Long
    n = Len(line)
    Dim current As String
    current = ""
    Dim inQuotes As Boolean
    inQuotes = False
    i = 1

    Do While i <= n
        Dim ch As String
        ch = Mid(line, i, 1)

        If inQuotes Then
            If ch = """" Then
                If i < n And Mid(line, i + 1, 1) = """" Then
                    current = current & """"
                    i = i + 1
                Else
                    inQuotes = False
                End If
            Else
                current = current & ch
            End If
        Else
            If ch = """" Then
                inQuotes = True
            ElseIf ch = "," Then
                result(resultCount) = current
                resultCount = resultCount + 1
                If resultCount > UBound(result) Then ReDim Preserve result(0 To UBound(result) + 10)
                current = ""
            Else
                current = current & ch
            End If
        End If
        i = i + 1
    Loop

    result(resultCount) = current
    resultCount = resultCount + 1

    ReDim Preserve result(0 To resultCount - 1)
    ParseCsvLine = result
End Function
