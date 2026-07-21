import re

def main():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We will build templates manually because regexing the entire DOM is error prone.
    pass

if __name__ == '__main__':
    main()
